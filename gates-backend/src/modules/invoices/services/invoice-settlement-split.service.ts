import { Decimal } from '@prisma/client/runtime/library';
import { Prisma } from '@prisma/client';
import { AppError } from '../../../shared/middleware/error-handler';
import { roundTo4 } from '../../../shared/utils/decimal-round';
import { cashTransactionService } from '../../treasury/services/cash-transaction.service';
import { treasuryPostingService } from '../../treasury/services/treasury-posting.service';
import { chequeLifecycleService } from '../../treasury/services/cheque-lifecycle.service';
import prisma from '../../../shared/database/prisma';
import type { TreasuryPostingContext } from '../../treasury/types/treasury.types';
import type { SettleInvoiceSplitsInput } from '../schemas/invoice-m5.schema';
import type { InvoicePostingContext } from '../types/invoice-posting.types';
import {
  invoicePaymentSplitsSchema,
  paymentSplitTenders,
  validatePaymentSplitsTotal,
  withNormalizedOnAccount,
  type InvoicePaymentSplitLine,
} from '../types/invoice-payment-split.types';
import {
  createPaymentAllocationInTx,
  refreshInvoiceBalanceInTx,
} from './invoice-balance.service';
import { countActiveInvoiceSettlementsInTx, settlementKind } from './invoice-settlement.service';
import { shouldSkipInvoiceAutoSettle } from './invoice-settlement-policy';

function parseSplits(raw: unknown): InvoicePaymentSplitLine[] {
  const parsed = invoicePaymentSplitsSchema.safeParse(raw);
  if (!parsed.success || !parsed.data?.length) {
    throw new AppError(422, 'بيانات التحصيل غير مكتملة. حدد الخزينة أو البنك أو الشيك ثم أعد الحفظ.');
  }
  return parsed.data;
}

export function isSplitPaymentInvoice(invoice: {
  paymentMethod?: string | null;
  paymentSplits?: unknown;
}): boolean {
  const method = (invoice.paymentMethod ?? '').trim().toUpperCase();
  if (method === 'SPLIT') return true;
  return paymentSplitTenders(invoice.paymentSplits).length > 0;
}

export class InvoiceSettlementSplitService {
  async autoSettleSplitInTx(
    tx: Prisma.TransactionClient,
    ctx: InvoicePostingContext,
    invoice: {
      id: string;
      invoiceKind: string | null;
      invoiceNumber: string | null;
      date: Date;
      currencyCode: string;
      customerId: string | null;
      supplierId: string | null;
      netAmount: Decimal | number;
      paymentSplits: unknown;
    }
  ) {
    const grandTotal = roundTo4(Number(invoice.netAmount));
    const splits = withNormalizedOnAccount(parseSplits(invoice.paymentSplits), grandTotal);
    const tendered = splits
      .filter((line) => line.type !== 'ON_ACCOUNT')
      .reduce((sum, line) => sum + Number(line.amount || 0), 0);
    if (tendered > grandTotal + 0.0001) {
      throw new AppError(
        422,
        `توزيع التحصيل أكبر من إجمالي الفاتورة (${grandTotal.toFixed(2)})`
      );
    }
    if (!validatePaymentSplitsTotal(splits, grandTotal)) {
      throw new AppError(
        422,
        `توزيع التحصيل يجب أن يساوي إجمالي الفاتورة (${grandTotal.toFixed(2)})`
      );
    }

    const existing = await countActiveInvoiceSettlementsInTx(tx, ctx.companyId, invoice.id);
    if (shouldSkipInvoiceAutoSettle(existing.allocationCount, existing.chequeCount)) {
      return;
    }

    const treasuryCtx: TreasuryPostingContext = {
      companyId: ctx.companyId,
      branchId: ctx.branchId,
      fiscalYearId: ctx.fiscalYearId,
      userId: ctx.userId,
    };

    const kind = settlementKind(invoice.invoiceKind);
    const label = invoice.invoiceNumber ?? invoice.id.slice(0, 8);

    await this.applySplitLinesInTx(tx, treasuryCtx, {
      invoice,
      splits,
      kind,
      label,
      date: invoice.date,
    });

    await refreshInvoiceBalanceInTx(tx, ctx.companyId, invoice.id);
  }

  async applySplitLinesInTx(
    tx: Prisma.TransactionClient,
    treasuryCtx: TreasuryPostingContext,
    params: {
      invoice: {
        id: string;
        invoiceKind: string | null;
        invoiceNumber: string | null;
        date: Date;
        currencyCode: string;
        customerId: string | null;
        supplierId: string | null;
      };
      splits: InvoicePaymentSplitLine[];
      kind: ReturnType<typeof settlementKind>;
      label: string;
      date: Date;
    }
  ) {
    const { invoice, splits, kind, label, date } = params;

    for (const line of splits) {
      if (line.type === 'ON_ACCOUNT') continue;

      const amount = roundTo4(line.amount);
      if (amount <= 0) continue;

      if (line.type === 'CASH' || line.type === 'BANK') {
        const cashTx = await cashTransactionService.createInTx(
          tx,
          treasuryCtx.companyId,
          treasuryCtx.branchId ?? undefined,
          treasuryCtx.fiscalYearId,
          {
            transactionKind: kind,
            date,
            description:
              line.type === 'BANK'
                ? kind === 'RECEIPT'
                  ? `إشعار إضافة بنكي — فاتورة ${label}${line.referenceNumber ? ` (${line.referenceNumber})` : ''}`
                  : `إشعار خصم بنكي — فاتورة ${label}${line.referenceNumber ? ` (${line.referenceNumber})` : ''}`
                : `نقدية — فاتورة ${label}`,
            amount,
            currencyCode: invoice.currencyCode,
            customerId: invoice.customerId ?? undefined,
            supplierId: invoice.supplierId ?? undefined,
            safeId: line.type === 'CASH' ? line.safeId : undefined,
            bankAccountId: line.type === 'BANK' ? line.bankAccountId : undefined,
            voucherNumber: line.type === 'BANK' ? line.referenceNumber : undefined,
          },
          { invoiceId: invoice.id }
        );

        await treasuryPostingService.postCashTransactionInTx(tx, treasuryCtx, cashTx.id);

        await createPaymentAllocationInTx(tx, {
          companyId: treasuryCtx.companyId,
          cashTransactionId: cashTx.id,
          invoiceId: invoice.id,
          allocatedAmount: amount,
          allocatedAt: date,
        });
      }

      if (line.type === 'CHEQUE') {
        if (kind === 'RECEIPT') {
          if (!invoice.customerId) {
            throw new AppError(422, 'Cheque receipt requires a customer on the invoice');
          }
          await chequeLifecycleService.createInwardChequeInTx(
            tx,
            treasuryCtx,
            {
              chequeNumber: line.chequeNumber,
              bankName: line.bankName,
              dueDate: line.dueDate,
              amount,
              currencyCode: invoice.currencyCode,
              customerId: invoice.customerId,
              description: `شيك فاتورة ${label}`,
            },
            { invoiceId: invoice.id }
          );
        } else {
          if (!invoice.supplierId) {
            throw new AppError(422, 'Cheque payment requires a supplier on the invoice');
          }
          const bankAccountId =
            line.bankAccountId ??
            (splits.find((s) => s.type === 'BANK')?.type === 'BANK'
              ? (splits.find((s) => s.type === 'BANK') as { bankAccountId: string }).bankAccountId
              : undefined);
          await chequeLifecycleService.issueOutwardChequeInTx(
            tx,
            treasuryCtx,
            {
              chequeNumber: line.chequeNumber,
              bankName: line.bankName,
              dueDate: line.dueDate,
              amount,
              currencyCode: invoice.currencyCode,
              supplierId: invoice.supplierId,
              bankAccountId,
              description: `شيك دفع فاتورة ${label}`,
            },
            { invoiceId: invoice.id }
          );
        }
      }
    }
  }

  /** Extra cash/bank/cheque collection on an already posted invoice. */
  async settleAdditional(ctx: TreasuryPostingContext, invoiceId: string, input: SettleInvoiceSplitsInput) {
    const invoice = await prisma.invoice.findFirst({
      where: { id: invoiceId, companyId: ctx.companyId },
      select: {
        id: true,
        invoiceKind: true,
        invoiceNumber: true,
        date: true,
        currencyCode: true,
        customerId: true,
        supplierId: true,
        netAmount: true,
        paidAmount: true,
        isPosted: true,
        isCancelled: true,
      },
    });
    if (!invoice) throw new AppError(404, 'Invoice not found');
    if (invoice.isCancelled) throw new AppError(422, 'Cancelled invoices cannot be settled');
    if (!invoice.isPosted) {
      throw new AppError(422, 'Post the invoice before recording a settlement');
    }

    const outstanding = roundTo4(Number(invoice.netAmount) - Number(invoice.paidAmount));
    if (outstanding <= 0) throw new AppError(422, 'Invoice is already fully settled');

    const tenders = input.paymentSplits.filter((line) => line.type !== 'ON_ACCOUNT');
    const tenderTotal = roundTo4(tenders.reduce((sum, line) => sum + Number(line.amount || 0), 0));
    if (tenderTotal <= 0) {
      throw new AppError(422, 'حدد مبلغ نقدي أو بنكي أو شيك');
    }
    if (tenderTotal > outstanding + 0.0001) {
      throw new AppError(
        422,
        `Settlement amount exceeds the outstanding balance (${outstanding.toFixed(2)})`
      );
    }

    const date = input.date ?? new Date();
    const kind = settlementKind(invoice.invoiceKind);
    const label = invoice.invoiceNumber ?? invoice.id.slice(0, 8);

    return prisma.$transaction(async (tx) => {
      await this.applySplitLinesInTx(tx, ctx, {
        invoice,
        splits: input.paymentSplits,
        kind,
        label,
        date,
      });
      return refreshInvoiceBalanceInTx(tx, ctx.companyId, invoice.id);
    });
  }
}

export const invoiceSettlementSplitService = new InvoiceSettlementSplitService();
