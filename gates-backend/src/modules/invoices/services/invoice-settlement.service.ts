import { Decimal } from '@prisma/client/runtime/library';
import { Prisma } from '@prisma/client';
import prisma from '../../../shared/database/prisma';
import { AppError } from '../../../shared/middleware/error-handler';
import { roundTo4, amountsEqualAt4 } from '../../../shared/utils/decimal-round';
import { cashTransactionService } from '../../treasury/services/cash-transaction.service';
import { treasuryPostingService } from '../../treasury/services/treasury-posting.service';
import { treasuryAccountResolverService } from '../../treasury/services/treasury-account-resolver.service';
import {
  journalPostingService,
  type JournalPostingContext,
} from '../../accounting/services/journal-posting.service';
import type {
  CashTransactionKind,
  TreasuryPostingContext,
} from '../../treasury/types/treasury.types';
import type { SettleM5InvoiceInput } from '../schemas/invoice-m5.schema';
import type { InvoiceKind } from '../types/invoice-posting.types';
import type { InvoicePostingContext } from '../types/invoice-posting.types';
import { chequeLifecycleService } from '../../treasury/services/cheque-lifecycle.service';
import {
  createPaymentAllocationInTx,
  refreshInvoiceBalance,
  refreshInvoiceBalanceInTx,
} from './invoice-balance.service';
import {
  INVOICE_UNPOST_BLOCKED_CHEQUE_MESSAGE,
  isChequeStatusBlockingInvoiceUnpost,
  shouldSkipInvoiceAutoSettle,
} from './invoice-settlement-policy';

/**
 * Wave 2 fix: posts the realized FX gain/loss when a foreign-currency
 * invoice is settled at a different rate than the one it was originally
 * booked at. The settlement's own cash JE already relieves the party
 * account at `settledFC * settlementRate` (uniform header rate on both its
 * lines); the party account was originally debited/credited at
 * `settledFC * invoiceRate`. The gap between those two base-currency amounts
 * is the residual left on the party account, cleared here against a
 * dedicated FX gain/loss account instead of silently drifting the ledger.
 */
async function postFxDifferenceInTx(
  tx: Prisma.TransactionClient,
  ctx: JournalPostingContext,
  params: {
    kind: CashTransactionKind;
    partyAccountId: string;
    settledFC: number;
    invoiceRate: number;
    settlementRate: number;
    currencyCode: string;
    date: Date;
    sourceNumber: string;
  }
) {
  const residual = roundTo4(
    params.settledFC * (params.invoiceRate - params.settlementRate)
  );
  if (Math.abs(residual) < 0.005) return null;
  if (!ctx.fiscalYearId) {
    throw new AppError(422, 'Fiscal year is required to post a realized FX gain/loss');
  }

  const { fxGainAccountId, fxLossAccountId } =
    await treasuryAccountResolverService.resolveFxAccounts(ctx.companyId);

  // RECEIPT (AR relieved): residual > 0 means we collected less base-currency
  // value than booked — a loss. PAYMENT (AP relieved): residual > 0 means we
  // paid out less than booked — a gain. Signs flip between the two.
  const isReceipt = params.kind === 'RECEIPT';
  const isLoss = isReceipt ? residual > 0 : residual < 0;
  const amount = Math.abs(residual);

  const lines = isLoss
    ? [
        { accountId: fxLossAccountId, debit: amount, credit: 0, lineOrder: 1 },
        { accountId: params.partyAccountId, debit: 0, credit: amount, lineOrder: 2 },
      ]
    : [
        { accountId: params.partyAccountId, debit: amount, credit: 0, lineOrder: 1 },
        { accountId: fxGainAccountId, debit: 0, credit: amount, lineOrder: 2 },
      ];

  return journalPostingService.createAndPostInTx(tx, ctx, {
    fiscalYearId: ctx.fiscalYearId,
    date: params.date,
    // Type narrowed above; fiscalYearId is guaranteed to be a string here.
    description: `Realized FX ${isLoss ? 'loss' : 'gain'} on settlement — ${params.sourceNumber}`,
    currencyCode: params.currencyCode,
    entryType: 'FxRevaluation',
    sourceType: 'FXDIFF',
    sourceNumber: params.sourceNumber,
    lines,
  });
}

export function settlementKind(invoiceKind: string | null): CashTransactionKind {
  switch (invoiceKind as InvoiceKind) {
    case 'SALE':
    case 'PURCHASE_RETURN':
      return 'RECEIPT';
    case 'PURCHASE':
    case 'SALE_RETURN':
      return 'PAYMENT';
    default:
      return 'RECEIPT';
  }
}

export function isImmediateCashInvoice(invoice: {
  paymentMethod?: string | null;
  netAmount: Decimal | number;
  paidAmount?: Decimal | number | null;
}): boolean {
  const pm = (invoice.paymentMethod ?? '').trim().toUpperCase();
  if (pm === 'CASH') return true;
  const net = Number(invoice.netAmount);
  const paid = Number(invoice.paidAmount ?? 0);
  return paid > 0 && amountsEqualAt4(paid, net);
}

export async function countActiveInvoiceSettlementsInTx(
  tx: Prisma.TransactionClient,
  companyId: string,
  invoiceId: string
) {
  const [allocationCount, chequeCount] = await Promise.all([
    tx.paymentAllocation.count({
      where: {
        companyId,
        invoiceId,
        cashTransaction: { isPosted: true, isCancelled: false },
      },
    }),
    tx.cheque.count({
      where: {
        companyId,
        invoiceId,
        status: { notIn: ['CANCELLED', 'BOUNCED'] },
      },
    }),
  ]);
  return { allocationCount, chequeCount };
}

async function resolveDefaultSafeId(companyId: string, branchId?: string | null): Promise<string> {
  if (branchId) {
    const branch = await prisma.branch.findFirst({
      where: { id: branchId, companyId },
      select: { defaultSafeId: true },
    });
    if (branch?.defaultSafeId) return branch.defaultSafeId;
  }
  const safe = await prisma.safe.findFirst({
    where: { companyId, isActive: true },
    orderBy: { createdAt: 'asc' },
    select: { id: true },
  });
  if (!safe) {
    throw new AppError(422, 'No active cash safe configured for automatic settlement');
  }
  return safe.id;
}

export class InvoiceSettlementService {
  /**
   * Creates and posts a treasury settlement inside the invoice posting transaction (cash sales/purchases).
   */
  async autoSettleCashInTx(
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
    },
    settlementAmount: number
  ) {
    if (settlementAmount <= 0) return null;

    const existing = await countActiveInvoiceSettlementsInTx(tx, ctx.companyId, invoice.id);
    if (shouldSkipInvoiceAutoSettle(existing.allocationCount, existing.chequeCount)) {
      return null;
    }

    const kind = settlementKind(invoice.invoiceKind);
    const safeId = await resolveDefaultSafeId(ctx.companyId, ctx.branchId);
    const amount = roundTo4(settlementAmount);

    const cashTx = await cashTransactionService.createInTx(
      tx,
      ctx.companyId,
      ctx.branchId ?? undefined,
      ctx.fiscalYearId,
      {
        transactionKind: kind,
        date: invoice.date,
        description: `تسوية نقدية — فاتورة ${invoice.invoiceNumber ?? invoice.id.slice(0, 8)}`,
        amount,
        currencyCode: invoice.currencyCode,
        customerId: invoice.customerId ?? undefined,
        supplierId: invoice.supplierId ?? undefined,
        safeId,
      },
      { invoiceId: invoice.id }
    );

    await treasuryPostingService.postCashTransactionInTx(tx, ctx, cashTx.id);

    await createPaymentAllocationInTx(tx, {
      companyId: ctx.companyId,
      cashTransactionId: cashTx.id,
      invoiceId: invoice.id,
      allocatedAmount: amount,
      allocatedAt: invoice.date,
    });

    await refreshInvoiceBalanceInTx(tx, ctx.companyId, invoice.id);

    return cashTx.id;
  }

  /**
   * Records a payment against a posted invoice: creates a treasury cash transaction
   * linked to the invoice, posts it, then refreshes paidAmount / remainingAmount from
   * the posted settlements so the two can never drift.
   */
  async settle(
    ctx: TreasuryPostingContext,
    invoiceId: string,
    input: SettleM5InvoiceInput
  ) {
    const invoice = await prisma.invoice.findFirst({
      where: { id: invoiceId, companyId: ctx.companyId },
      select: {
        id: true,
        invoiceKind: true,
        invoiceNumber: true,
        currencyCode: true,
        customerId: true,
        supplierId: true,
        netAmount: true,
        paidAmount: true,
        isPosted: true,
        isCancelled: true,
        exchangeRate: true,
      },
    });
    if (!invoice) throw new AppError(404, 'Invoice not found');
    if (invoice.isCancelled) throw new AppError(422, 'Cancelled invoices cannot be settled');
    if (!invoice.isPosted) {
      throw new AppError(422, 'Post the invoice before recording a settlement');
    }

    const outstanding = Number(invoice.netAmount) - Number(invoice.paidAmount);
    if (outstanding <= 0) throw new AppError(422, 'Invoice is already fully settled');
    if (input.amount > outstanding + 0.0001) {
      throw new AppError(
        422,
        `Settlement amount exceeds the outstanding balance (${outstanding.toFixed(2)})`
      );
    }

    const kind = settlementKind(invoice.invoiceKind);

    // Wave 4 fix: cash-transaction creation, treasury posting, payment
    // allocation, FX-difference posting, and the balance refresh used to be
    // four/five separate `prisma.$transaction` calls. If posting succeeded
    // (cash left the safe, GL posted, party balance moved) but the
    // allocation step afterwards failed for any reason, the invoice's
    // `remainingAmount` would never reflect a settlement that had already
    // moved real money and hit the ledger — an un-recoverable split-brain
    // between the cash/GL side and the invoice/AR side. One transaction
    // means either all of it lands or none of it does.
    let fxJournalEntryId: string | null = null;
    const { cashTx, totals } = await prisma.$transaction(async (tx) => {
      const cashTx = await cashTransactionService.createInTx(
        tx,
        ctx.companyId,
        ctx.branchId ?? undefined,
        ctx.fiscalYearId,
        {
          transactionKind: kind,
          voucherNumber: input.voucherNumber,
          date: input.date ?? new Date(),
          description:
            input.description ??
            `تسوية فاتورة ${invoice.invoiceNumber ?? invoice.id.slice(0, 8)}`,
          amount: input.amount,
          currencyCode: invoice.currencyCode,
          customerId: invoice.customerId ?? undefined,
          supplierId: invoice.supplierId ?? undefined,
          offsetAccountId: input.offsetAccountId,
          safeId: input.safeId,
          bankAccountId: input.bankAccountId,
          exchangeRate: input.exchangeRate,
        },
        { invoiceId: invoice.id }
      );

      await treasuryPostingService.postCashTransactionInTx(tx, ctx, cashTx.id);

      await createPaymentAllocationInTx(tx, {
        companyId: ctx.companyId,
        cashTransactionId: cashTx.id,
        invoiceId: invoice.id,
        allocatedAmount: input.amount,
      });

      const invoiceRate = Number(invoice.exchangeRate ?? 1);
      const settlementRate = input.exchangeRate ?? invoiceRate;
      if (input.exchangeRate != null && Math.abs(invoiceRate - settlementRate) > 0.0000005) {
        const partyAccountId = await treasuryAccountResolverService.resolvePartyAccountId({
          companyId: ctx.companyId,
          customerId: invoice.customerId,
          supplierId: invoice.supplierId,
          invoiceId: invoice.id,
        });
        const fxJe = await postFxDifferenceInTx(tx, ctx, {
          kind,
          partyAccountId,
          settledFC: input.amount,
          invoiceRate,
          settlementRate,
          currencyCode: invoice.currencyCode,
          date: input.date ?? new Date(),
          sourceNumber: invoice.invoiceNumber ?? invoice.id.slice(0, 8),
        });
        fxJournalEntryId = fxJe?.id ?? null;
      }

      const totals = await refreshInvoiceBalanceInTx(tx, ctx.companyId, invoice.id);
      return { cashTx, totals };
    });

    return { cashTransactionId: cashTx.id, fxJournalEntryId, ...totals };
  }

  /** Reverses a settlement: unposts its cash transaction and re-derives the balance. */
  async reverse(ctx: TreasuryPostingContext, invoiceId: string, cashTransactionId: string) {
    const cashTx = await prisma.cashTransaction.findFirst({
      where: { id: cashTransactionId, companyId: ctx.companyId, invoiceId },
      select: { id: true, isPosted: true },
    });
    if (!cashTx) throw new AppError(404, 'Settlement not found for this invoice');

    if (cashTx.isPosted) {
      await treasuryPostingService.unpostCashTransaction(ctx, cashTx.id);
    }
    await prisma.cashTransaction.update({
      where: { id: cashTx.id },
      data: { isCancelled: true },
    });

    return refreshInvoiceBalance(ctx.companyId, invoiceId);
  }

  /**
   * Reverse cash/cheque settlements created at invoice post, inside the unpost transaction.
   * Banked/cleared cheques block unpost rather than being silently voided.
   */
  async teardownSettlementsInTx(
    tx: Prisma.TransactionClient,
    ctx: InvoicePostingContext,
    invoiceId: string
  ) {
    const treasuryCtx: TreasuryPostingContext = {
      companyId: ctx.companyId,
      branchId: ctx.branchId,
      fiscalYearId: ctx.fiscalYearId,
      userId: ctx.userId,
    };

    const cheques = await tx.cheque.findMany({
      where: { companyId: ctx.companyId, invoiceId },
    });
    const blocking = cheques.find((c) => isChequeStatusBlockingInvoiceUnpost(c.status));
    if (blocking) {
      throw new AppError(422, INVOICE_UNPOST_BLOCKED_CHEQUE_MESSAGE);
    }

    const allocations = await tx.paymentAllocation.findMany({
      where: { companyId: ctx.companyId, invoiceId },
      select: { id: true, cashTransactionId: true },
    });

    const cashTxIds = new Set<string>();
    for (const row of allocations) {
      cashTxIds.add(row.cashTransactionId);
    }

    const linkedCash = await tx.cashTransaction.findMany({
      where: {
        companyId: ctx.companyId,
        invoiceId,
        OR: [{ isPosted: true }, { isCancelled: false }],
      },
      select: { id: true, isPosted: true },
    });
    for (const row of linkedCash) {
      cashTxIds.add(row.id);
    }

    for (const cashTransactionId of cashTxIds) {
      await treasuryPostingService.unpostCashTransactionInTx(
        tx,
        treasuryCtx,
        cashTransactionId,
        { cancel: true }
      );
    }

    if (allocations.length > 0) {
      await tx.paymentAllocation.deleteMany({
        where: { companyId: ctx.companyId, invoiceId },
      });
    }

    for (const cheque of cheques) {
      if (cheque.status === 'CANCELLED' || cheque.status === 'BOUNCED') continue;
      await chequeLifecycleService.voidLinkedChequeOnInvoiceUnpostInTx(tx, treasuryCtx, cheque);
    }

    await refreshInvoiceBalanceInTx(tx, ctx.companyId, invoiceId);
  }

  async list(companyId: string, invoiceId: string) {
    return prisma.cashTransaction.findMany({
      where: { companyId, invoiceId },
      orderBy: [{ date: 'asc' }, { createdAt: 'asc' }],
      select: {
        id: true,
        transactionKind: true,
        voucherNumber: true,
        date: true,
        amount: true,
        currencyCode: true,
        description: true,
        safeId: true,
        bankAccountId: true,
        isPosted: true,
        isCancelled: true,
        journalEntryId: true,
        safe: { select: { id: true, arabicName: true, code: true } },
        bankAccount: {
          select: {
            id: true,
            accountNumber: true,
            bank: { select: { arabicName: true } },
          },
        },
      },
    });
  }

  /**
   * H5 fix (part 2): cheques received/issued against the invoice but not
   * yet cleared by the bank — real paper, not yet real cash. Surfaced as a
   * distinct "under collection" position rather than folded into
   * paidAmount (see sumChequeSettlements in invoice-balance.service.ts).
   */
  async listCheques(companyId: string, invoiceId: string) {
    const cheques = await prisma.cheque.findMany({
      where: { companyId, invoiceId },
      orderBy: [{ dueDate: 'asc' }],
      select: {
        id: true,
        chequeNumber: true,
        bankName: true,
        direction: true,
        status: true,
        dueDate: true,
        amount: true,
        currencyCode: true,
        description: true,
      },
    });
    const underCollection = roundTo4(
      cheques
        .filter(
          (c) =>
            c.status === 'UNDER_HAND' || c.status === 'SENT_TO_BANK'
        )
        .reduce((sum, c) => sum + Number(c.amount), 0)
    );
    return { cheques, chequesUnderCollection: underCollection };
  }
}

export const invoiceSettlementService = new InvoiceSettlementService();
