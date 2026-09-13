import type { Prisma } from '@prisma/client';
import prisma from '../../../shared/database/prisma';
import { AppError } from '../../../shared/middleware/error-handler';
import { documentSequenceService } from '../../platform/services/document-sequence.service';
import { fiscalYearService } from '../../platform/services/fiscal-year.service';
import { companySettingService } from '../../platform/services/company-setting.service';
import { isImmediateCashInvoice } from '../../invoices/services/invoice-settlement.service';
import { journalPostingService, type JournalPostingContext } from './journal-posting.service';
import { glAccountResolver } from './gl-account-resolver.service';
import { customerLedgerAccountService } from './customer-ledger-account.service';
import {
  buildChequeBounceLines,
  buildChequeCollectLines,
  buildChequeEndorseLines,
  buildContractorExtractPaymentLines,
  buildPurchaseInvoiceLines,
  buildSalesInvoiceLines,
  buildTreasuryPaymentLines,
  buildTreasuryReceiptLines,
} from './auto-gl-line-builders';
import type { JournalEntryLineData } from '../types/journal-entry.types';
import { AUTO_GL_SOURCE, type AutoGlCommitInput, type AutoGlPostDocumentInput } from '../types/auto-gl-posting.types';
import { assertJournalBalanced, normalizeAutoGlSourceType } from './auto-gl-balance';

export { assertJournalBalanced, normalizeAutoGlSourceType };

export class AutoGlPostingService {
  async isAutoPostEnabled(companyId: string): Promise<boolean> {
    const settings = await prisma.companySettings.findUnique({
      where: { companyId },
      select: { autoPostGl: true },
    });
    if (settings?.autoPostGl === false) return false;
    const glPost = await companySettingService.getFlag(companyId, 'GLPost', true);
    return glPost;
  }

  /**
   * Atomic, idempotent write of a balanced journal entry inside the caller's tx.
   * Draft rows are replaced in place; posted rows are returned unchanged.
   */
  async commitInTx(
    tx: Prisma.TransactionClient,
    ctx: JournalPostingContext,
    input: AutoGlCommitInput
  ) {
    if (input.requireAutoPostFlag === true) {
      const enabled = await this.isAutoPostEnabled(ctx.companyId);
      if (!enabled) return null;
    }

    const sourceType = normalizeAutoGlSourceType(input.sourceType);
    const lines = await glAccountResolver.enforceCostCenters(
      tx,
      ctx.companyId,
      input.lines,
      input.costCenterId
    );
    assertJournalBalanced(lines);

    const existing = await tx.journalEntry.findFirst({
      where: {
        companyId: ctx.companyId,
        sourceType,
        sourceId: input.sourceId,
        deletedAt: null,
        isCancelled: false,
        reversalOfJournalEntryId: null,
      },
      include: { lines: { orderBy: { lineOrder: 'asc' } } },
    });

    if (existing?.isPosted) {
      return existing;
    }

    if (existing && !existing.isPosted) {
      await tx.journalEntryLine.deleteMany({ where: { journalEntryId: existing.id } });
      await tx.journalEntry.delete({ where: { id: existing.id } });
    }

    const fiscalYearId =
      input.fiscalYearId ||
      ctx.fiscalYearId ||
      (await fiscalYearService.assertOpenForDate(ctx.companyId, input.date));
    const legacyGlNum =
      input.legacyGlNum ??
      (await documentSequenceService.nextGlNumberInTx(tx, { ...ctx, fiscalYearId }));

    return journalPostingService.createAndPostInTx(tx, ctx, {
      date: input.date,
      hijriDate: input.hijriDate,
      description: input.description,
      currencyCode: input.currencyCode,
      exchangeRate: input.exchangeRate,
      fiscalYearId,
      legacyGlNum,
      entryType: input.entryType ?? sourceType,
      sourceType,
      sourceNumber: input.sourceNumber ?? input.sourceId.slice(0, 30),
      sourceYearId: input.sourceYearId,
      sourceId: input.sourceId,
      lines,
    });
  }

  /**
   * Build + commit GL for a persisted source document.
   */
  async postDocument(
    tx: Prisma.TransactionClient,
    ctx: JournalPostingContext,
    input: AutoGlPostDocumentInput
  ) {
    const enabled = await this.isAutoPostEnabled(ctx.companyId);
    if (!enabled) return null;

    const sourceType = normalizeAutoGlSourceType(input.sourceType);
    const built = await this.buildDocumentLines(
      tx,
      ctx.companyId,
      sourceType,
      input.sourceId,
      input.cogsAmount
    );
    if (!built) return null;

    return this.commitInTx(tx, ctx, {
      ...built,
      sourceType,
      sourceId: input.sourceId,
      fiscalYearId: ctx.fiscalYearId ?? (await fiscalYearService.assertOpenForDate(ctx.companyId, built.date)),
      costCenterId: input.costCenterId ?? built.costCenterId,
      requireAutoPostFlag: false,
    });
  }

  private async buildDocumentLines(
    tx: Prisma.TransactionClient,
    companyId: string,
    sourceType: string,
    sourceId: string,
    cogsAmount?: number
  ): Promise<
    | (Pick<
        AutoGlCommitInput,
        'date' | 'description' | 'currencyCode' | 'exchangeRate' | 'lines' | 'sourceNumber' | 'entryType' | 'costCenterId'
      >)
    | null
  > {
    if (sourceType === AUTO_GL_SOURCE.SALES_INVOICE || sourceType === AUTO_GL_SOURCE.SALE_RETURN) {
      return this.buildInvoiceBundle(tx, companyId, sourceId, 'SALE', cogsAmount);
    }
    if (sourceType === AUTO_GL_SOURCE.PURCHASE_INVOICE || sourceType === AUTO_GL_SOURCE.PURCHASE_RETURN) {
      return this.buildInvoiceBundle(tx, companyId, sourceId, 'PURCHASE');
    }
    if (sourceType === AUTO_GL_SOURCE.TREASURY_RECEIPT) {
      return this.buildTreasuryReceiptBundle(tx, companyId, sourceId);
    }
    if (sourceType === AUTO_GL_SOURCE.TREASURY_PAYMENT) {
      return this.buildTreasuryPaymentBundle(tx, companyId, sourceId);
    }
    if (sourceType === AUTO_GL_SOURCE.CONTRACTOR_EXTRACT_PAYMENT) {
      return this.buildExtractPaymentBundle(tx, companyId, sourceId);
    }
    if (
      sourceType === AUTO_GL_SOURCE.CHECK_COLLECT ||
      sourceType === AUTO_GL_SOURCE.CHECK_BOUNCE ||
      sourceType === AUTO_GL_SOURCE.CHECK_ENDORSE
    ) {
      return this.buildChequeBundle(tx, companyId, sourceId, sourceType);
    }
    return null;
  }

  private async buildInvoiceBundle(
    tx: Prisma.TransactionClient,
    companyId: string,
    invoiceId: string,
    family: 'SALE' | 'PURCHASE',
    cogsAmount?: number
  ) {
    const invoice = await tx.invoice.findFirst({
      where: { id: invoiceId, companyId },
    });
    if (!invoice) throw new AppError(404, 'Invoice not found');
    if (invoice.journalEntryId) {
      const existing = await tx.journalEntry.findFirst({ where: { id: invoice.journalEntryId } });
      if (existing) return null;
    }

    const accounts = await glAccountResolver.resolveCompanyDefaults(companyId);
    const merchandise = Number(invoice.totalAmount) - Number(invoice.discountAmount);
    const tax = Number(invoice.taxAmount);
    const net = Number(invoice.netAmount);
    const isCash = isImmediateCashInvoice(invoice);
    const cashAccountId = accounts.cashAccountId ?? accounts.bankAccountId ?? null;
    const partyAccountId =
      family === 'SALE' && invoice.customerId
        ? await customerLedgerAccountService.ensureForCustomer({
            companyId,
            customerId: invoice.customerId,
            branchId: invoice.branchId,
          })
        : undefined;

    const lines =
      family === 'SALE'
        ? buildSalesInvoiceLines(accounts, {
            net,
            merchandise,
            tax,
            developmentFee: Number(invoice.developmentFeeAmount ?? 0),
            cogs: cogsAmount ?? 0,
            isCash,
            customerId: invoice.customerId,
            cashAccountId,
            partyAccountId,
          })
        : buildPurchaseInvoiceLines(accounts, {
            net,
            merchandise,
            tax,
            developmentFee: Number(invoice.developmentFeeAmount ?? 0),
            wht: Number(invoice.withholdingTaxAmount ?? 0),
            isCash,
            supplierId: invoice.supplierId,
            cashAccountId,
          });

    return {
      date: invoice.date,
      description: invoice.description ?? `Invoice ${invoice.invoiceNumber ?? invoice.id}`,
      currencyCode: invoice.currencyCode,
      exchangeRate: invoice.exchangeRate != null ? Number(invoice.exchangeRate) : 1,
      sourceNumber: invoice.invoiceNumber ?? invoice.id.slice(0, 30),
      entryType: invoice.invoiceKind ?? family,
      costCenterId: invoice.costCenterId,
      lines,
    };
  }

  private async buildTreasuryReceiptBundle(
    tx: Prisma.TransactionClient,
    companyId: string,
    receiptId: string
  ) {
    const receipt = await tx.treasuryReceipt.findFirst({
      where: { id: receiptId, companyId },
    });
    if (!receipt) throw new AppError(404, 'Treasury receipt not found');
    if (receipt.journalEntryId) return null;

    const treasuryAccountId = await glAccountResolver.resolveCashOrBank(companyId, {
      safeId: receipt.safeId,
      bankAccountId: receipt.bankAccountId,
    });
    const counterpartAccountId = await glAccountResolver.resolvePartyAccount({
      companyId,
      customerId: receipt.customerId,
      supplierId: receipt.supplierId,
      accountId: receipt.accountId,
    });
    const amount = Number(receipt.amount);

    return {
      date: receipt.date,
      description: receipt.description ?? `Receipt ${receipt.voucherNumber ?? receipt.id}`,
      currencyCode: receipt.currencyCode,
      exchangeRate: receipt.exchangeRate != null ? Number(receipt.exchangeRate) : 1,
      sourceNumber: receipt.voucherNumber ?? receipt.id.slice(0, 30),
      entryType: 'TREASURY_RECEIPT',
      lines: buildTreasuryReceiptLines({
        treasuryAccountId,
        counterpartAccountId,
        amount,
        partnerId: receipt.customerId ?? receipt.supplierId ?? undefined,
        partnerType: receipt.customerId ? 'CUSTOMER' : receipt.supplierId ? 'SUPPLIER' : undefined,
      }),
    };
  }

  private async buildTreasuryPaymentBundle(
    tx: Prisma.TransactionClient,
    companyId: string,
    paymentId: string
  ) {
    const payment = await tx.treasuryPayment.findFirst({
      where: { id: paymentId, companyId },
    });
    if (!payment) throw new AppError(404, 'Treasury payment not found');
    if (payment.journalEntryId) return null;

    const treasuryAccountId = await glAccountResolver.resolveCashOrBank(companyId, {
      safeId: payment.safeId,
      bankAccountId: payment.bankAccountId,
    });
    const counterpartAccountId = await glAccountResolver.resolvePartyAccount({
      companyId,
      customerId: payment.customerId,
      supplierId: payment.supplierId,
      accountId: payment.accountId,
    });
    const amount = Number(payment.amount);

    return {
      date: payment.date,
      description: payment.description ?? `Payment ${payment.voucherNumber ?? payment.id}`,
      currencyCode: payment.currencyCode,
      exchangeRate: payment.exchangeRate != null ? Number(payment.exchangeRate) : 1,
      sourceNumber: payment.voucherNumber ?? payment.id.slice(0, 30),
      entryType: 'TREASURY_PAYMENT',
      lines: buildTreasuryPaymentLines({
        treasuryAccountId,
        counterpartAccountId,
        amount,
        partnerId: payment.customerId ?? payment.supplierId ?? undefined,
        partnerType: payment.customerId ? 'CUSTOMER' : payment.supplierId ? 'SUPPLIER' : undefined,
      }),
    };
  }

  private async buildExtractPaymentBundle(
    tx: Prisma.TransactionClient,
    companyId: string,
    paymentId: string
  ) {
    const payment = await tx.extractPayment.findFirst({
      where: { id: paymentId, project: { companyId } },
      include: {
        extract: true,
        contractor: { include: { contractorSettings: true } },
      },
    });
    if (!payment) throw new AppError(404, 'Extract payment not found');

    const accounts = await glAccountResolver.resolveCompanyDefaults(companyId);
    const other = (payment.contractor?.contractorSettings?.otherSettings ?? {}) as {
      contractorAccountId?: string;
    };
    const contractorAccountId = other.contractorAccountId
      ? await glAccountResolver.resolvePartyAccount({
          companyId,
          accountId: other.contractorAccountId,
        })
      : accounts.contractorAccountId ?? accounts.apAccountId;
    if (!contractorAccountId) {
      throw new AppError(422, 'Subcontractor account is not configured');
    }

    const treasuryAccountId = await glAccountResolver.resolveCashOrBank(companyId, {
      safeId: payment.safeId,
      bankAccountId: payment.bankAccountId,
    });

    const netPaid = Number(payment.paymentAmount);
    const retPct = Number(payment.contractor?.contractorSettings?.workInsurancePercentage ?? 0);
    const advPct = Number(payment.contractor?.contractorSettings?.advancePaymentPercentage ?? 0);
    const retention = retPct > 0 ? (netPaid * retPct) / 100 : 0;
    const advanceCap = Number(payment.extract.advancePayment ?? 0);
    const advanceRaw = advPct > 0 ? (netPaid * advPct) / 100 : 0;
    const advance = Math.min(advanceRaw, advanceCap || advanceRaw);

    return {
      date: payment.paymentDate,
      description: payment.description ?? `Extract payment ${payment.paymentNumber ?? payment.id}`,
      currencyCode: 'EGP',
      sourceNumber: payment.paymentNumber ?? payment.id.slice(0, 30),
      entryType: 'CONTRACTOR_EXTRACT_PAYMENT',
      lines: buildContractorExtractPaymentLines({
        contractorAccountId,
        treasuryAccountId,
        retentionAccountId: accounts.retentionAccountId,
        advanceAccountId: accounts.advanceAccountId,
        netPaid,
        retention,
        advance,
      }),
    };
  }

  private async buildChequeBundle(
    tx: Prisma.TransactionClient,
    companyId: string,
    chequeId: string,
    sourceType: string
  ) {
    const cheque = await tx.cheque.findFirst({
      where: { id: chequeId, companyId },
    });
    if (!cheque) throw new AppError(404, 'Cheque not found');

    const chequeAccounts = await (await import('../../treasury/services/treasury-account-resolver.service'))
      .treasuryAccountResolverService.resolveChequeAccounts(companyId);
    const amount = Number(cheque.amount);
    const treasuryAccountId = await glAccountResolver.resolveCashOrBank(companyId, {
      bankAccountId: cheque.bankAccountId,
    });

    let lines: JournalEntryLineData[];
    if (sourceType === AUTO_GL_SOURCE.CHECK_COLLECT) {
      lines = buildChequeCollectLines({
        bankAccountId: treasuryAccountId,
        chequeAssetAccountId: chequeAccounts.chequesUnderCollectionAccountId,
        amount,
      });
    } else if (sourceType === AUTO_GL_SOURCE.CHECK_BOUNCE) {
      const partyAccountId = await glAccountResolver.resolvePartyAccount({
        companyId,
        customerId: cheque.customerId,
        supplierId: cheque.supplierId,
      });
      lines = buildChequeBounceLines({
        partyAccountId,
        chequeAssetAccountId: chequeAccounts.chequesUnderCollectionAccountId,
        amount,
      });
    } else {
      if (!cheque.endorsedSupplierId && !cheque.supplierId) {
        throw new AppError(422, 'Endorse requires a supplier');
      }
      const supplierAccountId = await glAccountResolver.resolvePartyAccount({
        companyId,
        supplierId: cheque.endorsedSupplierId ?? cheque.supplierId,
      });
      lines = buildChequeEndorseLines({
        supplierAccountId,
        chequeAssetAccountId: chequeAccounts.chequesUnderHandAccountId,
        amount,
      });
    }

    return {
      date: cheque.dueDate ?? new Date(),
      description: `Cheque ${sourceType} ${cheque.chequeNumber}`,
      currencyCode: cheque.currencyCode,
      sourceNumber: cheque.chequeNumber,
      entryType: sourceType,
      lines,
    };
  }
}

export const autoGlPostingService = new AutoGlPostingService();
