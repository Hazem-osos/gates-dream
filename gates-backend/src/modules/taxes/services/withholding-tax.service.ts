import prisma from '../../../shared/database/prisma';
import { logger } from '../../../shared/logger';
import { AppError } from '../../../shared/middleware/error-handler';
import { cashTransactionService } from '../../treasury/services/cash-transaction.service';
import { treasuryPostingService } from '../../treasury/services/treasury-posting.service';
import type { TreasuryPostingContext } from '../../treasury/types/treasury.types';
import { fiscalYearService } from '../../platform/services/fiscal-year.service';

export interface WithholdingTaxPaymentData {
  supplierId: string;
  invoiceId?: string;
  paymentDate: Date;
  hijriDate?: string;
  taxAmount: number;
  /** WHT payable/liability account being cleared (debited). */
  accountId: string;
  /** Cash source paying the tax authority — one of safeId/bankAccountId is required. */
  safeId?: string;
  bankAccountId?: string;
  currencyCode?: string;
  notes?: string;
}

export class WithholdingTaxService {
  /**
   * H13 fix: remitting withheld tax to the tax authority is a real cash
   * outflow that clears a real liability — it must be a normal, balanced,
   * postable treasury payment (Dr WHT payable / Cr safe or bank), not a
   * single debit-only journal entry created by hand outside the ledger
   * pipeline. Routing through cashTransactionService + treasuryPostingService
   * gets balance validation, fiscal-period locks, idempotent GL posting,
   * safe/bank balance updates and reversal support for free — the same
   * infrastructure every other treasury payment already uses.
   *
   * Uses `offsetAccountId` (not customerId/supplierId) as the debit side:
   * the tax authority isn't a party account, and offsetAccountId already
   * takes priority in treasuryAccountResolverService.resolvePartyAccountId.
   * `invoiceId` is intentionally NOT linked on the cash transaction — this
   * settles a government liability, not the supplier invoice itself, and
   * linking it would incorrectly count toward the invoice's paidAmount.
   */
  async processWithholdingTaxPayment(
    companyId: string,
    userId: string,
    data: WithholdingTaxPaymentData
  ) {
    if (!data.accountId) {
      throw new AppError(422, 'accountId (withholding tax payable account) is required');
    }
    if (!data.safeId && !data.bankAccountId) {
      throw new AppError(422, 'safeId or bankAccountId is required to pay the tax authority');
    }
    if (!data.taxAmount || data.taxAmount <= 0) {
      throw new AppError(422, 'taxAmount must be a positive number');
    }

    const supplier = await prisma.supplier.findFirst({
      where: { id: data.supplierId, companyId },
    });
    if (!supplier) {
      throw new AppError(404, 'Supplier not found');
    }

    if (data.invoiceId) {
      const invoice = await prisma.invoice.findFirst({
        where: {
          id: data.invoiceId,
          companyId,
          supplierId: data.supplierId,
          invoiceKind: 'PURCHASE',
        },
      });
      if (!invoice) {
        throw new AppError(404, 'Invoice not found or does not belong to supplier');
      }
    }

    const account = await prisma.account.findFirst({
      where: { id: data.accountId, companyId },
    });
    if (!account) {
      throw new AppError(404, 'Account not found');
    }

    const currencyCode =
      data.currencyCode ??
      supplier.currencyCode ??
      (
        await prisma.companySettings.findUnique({
          where: { companyId },
          select: { defaultCurrency: true },
        })
      )?.defaultCurrency;
    if (!currencyCode) {
      throw new AppError(
        422,
        'currencyCode is required — supplier and company have no default currency configured'
      );
    }

    const branch = await prisma.branch.findFirst({
      where: { companyId },
      orderBy: { createdAt: 'asc' },
      select: { id: true },
    });
    if (!branch) {
      throw new AppError(422, 'Company has no branch configured');
    }
    const fiscalYearId = await fiscalYearService.assertOpenForDate(companyId, data.paymentDate);

    const cashTx = await cashTransactionService.create(
      companyId,
      branch.id,
      fiscalYearId,
      {
        transactionKind: 'PAYMENT',
        date: data.paymentDate,
        description: `Withholding Tax Payment — ${supplier.arabicName}${
          data.invoiceId ? ` (Invoice: ${data.invoiceId})` : ''
        }${data.notes ? `. ${data.notes}` : ''}`,
        amount: data.taxAmount,
        currencyCode,
        supplierId: data.supplierId,
        offsetAccountId: data.accountId,
        safeId: data.safeId,
        bankAccountId: data.bankAccountId,
      }
    );

    const ctx: TreasuryPostingContext = {
      companyId,
      branchId: branch.id,
      fiscalYearId,
      userId,
    };
    const posted = await treasuryPostingService.postCashTransaction(ctx, cashTx.id);

    logger.info(
      {
        companyId,
        supplierId: data.supplierId,
        invoiceId: data.invoiceId,
        taxAmount: data.taxAmount,
        cashTransactionId: posted.id,
        journalEntryId: posted.journalEntryId,
      },
      'Withholding tax payment processed'
    );

    return {
      cashTransactionId: posted.id,
      journalEntryId: posted.journalEntryId,
      supplierId: data.supplierId,
      invoiceId: data.invoiceId,
      taxAmount: data.taxAmount,
      paymentDate: data.paymentDate,
      accountId: data.accountId,
    };
  }

  /**
   * Get withholding tax payment history
   */
  async getWithholdingTaxHistory(
    companyId: string,
    supplierId?: string,
    fromDate?: Date,
    toDate?: Date
  ) {
    try {
      const where: any = {
        companyId,
        description: {
          contains: 'Withholding Tax Payment',
        },
      };

      if (supplierId) {
        where.description = {
          contains: supplierId,
        };
      }

      if (fromDate || toDate) {
        where.date = {};
        if (fromDate) {
          where.date.gte = fromDate;
        }
        if (toDate) {
          where.date.lte = toDate;
        }
      }

      const journalEntries = await prisma.journalEntry.findMany({
        where,
        orderBy: { date: 'desc' },
        include: {
          lines: {
            include: {
              account: {
                select: {
                  id: true,
                  code: true,
                  arabicName: true,
                },
              },
            },
          },
        },
      });

      return journalEntries;
    } catch (error) {
      logger.error(
        { error, companyId, supplierId, fromDate, toDate },
        'Error getting withholding tax history'
      );
      throw error;
    }
  }
}

export const withholdingTaxService = new WithholdingTaxService();
