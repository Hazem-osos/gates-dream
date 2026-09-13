import { Decimal } from '@prisma/client/runtime/library';
import type { Prisma } from '@prisma/client';
import prisma from '../../../shared/database/prisma';
import { AppError } from '../../../shared/middleware/error-handler';
import { roundTo4 } from '../../../shared/utils/decimal-round';
import { deriveInvoicePaymentStatus } from '../utils/invoice-payment-status';

type DbClient = Prisma.TransactionClient | typeof prisma;

async function sumPostedAllocations(db: DbClient, companyId: string, invoiceId: string) {
  const agg = await db.paymentAllocation.aggregate({
    where: {
      companyId,
      invoiceId,
      cashTransaction: { isPosted: true, isCancelled: false },
    },
    _sum: { allocatedAmount: true },
  });
  return Number(agg._sum.allocatedAmount ?? 0);
}

/**
 * H5 fix: a cheque only reduces the invoice's outstanding balance once the
 * bank has actually collected it. Counting UNDER_HAND (still in our drawer)
 * or SENT_TO_BANK (deposited, awaiting clearing) as "paid" overstates
 * collections/payments — uncollected paper is still fully at risk of
 * bouncing or being returned.
 */
async function sumChequeSettlements(db: DbClient, companyId: string, invoiceId: string) {
  const agg = await db.cheque.aggregate({
    where: {
      companyId,
      invoiceId,
      status: 'COLLECTED',
    },
    _sum: { amount: true },
  });
  return Number(agg._sum.amount ?? 0);
}

/**
 * H5 fix (part 2): cheques that have been received/issued against the
 * invoice but not yet cleared by the bank are a distinct "under collection"
 * position — real paper, not yet real cash. Surfaced separately so callers
 * can show it without folding it into paidAmount.
 */
async function sumChequesUnderCollection(db: DbClient, companyId: string, invoiceId: string) {
  const agg = await db.cheque.aggregate({
    where: {
      companyId,
      invoiceId,
      status: { in: ['UNDER_HAND', 'SENT_TO_BANK'] },
    },
    _sum: { amount: true },
  });
  return Number(agg._sum.amount ?? 0);
}

/** Legacy settlements: cash tx linked via invoiceId with no allocation rows. */
async function sumLegacyDirectSettlements(db: DbClient, companyId: string, invoiceId: string) {
  const txs = await db.cashTransaction.findMany({
    where: {
      companyId,
      invoiceId,
      isPosted: true,
      isCancelled: false,
      paymentAllocations: { none: {} },
    },
    select: { amount: true },
  });
  return txs.reduce((s, t) => s + Number(t.amount), 0);
}

export async function refreshInvoiceBalanceInTx(
  tx: Prisma.TransactionClient,
  companyId: string,
  invoiceId: string
) {
  const invoice = await tx.invoice.findFirst({
    where: { id: invoiceId, companyId },
    select: { netAmount: true },
  });
  if (!invoice) throw new AppError(404, 'Invoice not found');

  const fromAlloc = await sumPostedAllocations(tx, companyId, invoiceId);
  const fromLegacy = await sumLegacyDirectSettlements(tx, companyId, invoiceId);
  const fromCheques = await sumChequeSettlements(tx, companyId, invoiceId);
  const chequesUnderCollection = roundTo4(
    await sumChequesUnderCollection(tx, companyId, invoiceId)
  );
  const paidAmount = roundTo4(fromAlloc + fromLegacy + fromCheques);
  const netAmount = Number(invoice.netAmount);
  const remainingAmount = roundTo4(Math.max(netAmount - paidAmount, 0));
  const paymentStatus = deriveInvoicePaymentStatus(paidAmount, netAmount);

  await tx.invoice.update({
    where: { id: invoiceId },
    data: {
      paidAmount: new Decimal(paidAmount),
      remainingAmount: new Decimal(remainingAmount),
      paymentStatus,
    },
  });

  return { netAmount, paidAmount, remainingAmount, paymentStatus, chequesUnderCollection };
}

export async function refreshInvoiceBalance(companyId: string, invoiceId: string) {
  return prisma.$transaction((tx) => refreshInvoiceBalanceInTx(tx, companyId, invoiceId));
}

export async function createPaymentAllocationInTx(
  tx: Prisma.TransactionClient,
  params: {
    companyId: string;
    cashTransactionId: string;
    invoiceId: string;
    allocatedAmount: number;
    allocatedAt?: Date;
    counterpartyOffsetId?: string;
  }
) {
  return tx.paymentAllocation.create({
    data: {
      companyId: params.companyId,
      cashTransactionId: params.cashTransactionId,
      invoiceId: params.invoiceId,
      counterpartyOffsetId: params.counterpartyOffsetId,
      allocatedAmount: new Decimal(roundTo4(params.allocatedAmount)),
      allocatedAt: params.allocatedAt ?? new Date(),
    },
  });
}

export async function getCashTransactionUnappliedAmount(
  companyId: string,
  cashTransactionId: string
) {
  const tx = await prisma.cashTransaction.findFirst({
    where: { id: cashTransactionId, companyId },
    select: { amount: true, isPosted: true, isCancelled: true },
  });
  if (!tx) throw new AppError(404, 'Cash transaction not found');
  if (!tx.isPosted || tx.isCancelled) {
    throw new AppError(422, 'Cash transaction must be posted and active to allocate');
  }

  const allocated = await prisma.paymentAllocation.aggregate({
    where: { companyId, cashTransactionId },
    _sum: { allocatedAmount: true },
  });
  const total = Number(tx.amount);
  const applied = Number(allocated._sum.allocatedAmount ?? 0);
  return { total, applied, unapplied: roundTo4(Math.max(total - applied, 0)) };
}
