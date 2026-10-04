import { Decimal } from '@prisma/client/runtime/library';
import type { ContractingSettlementStatus, Prisma } from '@prisma/client';
import prisma from '../../../shared/database/prisma';
import { AppError } from '../../../shared/middleware/error-handler';
import { roundTo4 } from '../../../shared/utils/decimal-round';
import { deriveContractingSettlementStatus } from './contracting-settlement-status';

type DbClient = Prisma.TransactionClient | typeof prisma;

const ACTIVE_CASH_WHERE = {
  isPosted: true,
  isCancelled: false,
} as const;

async function sumClientInvoiceAllocations(
  db: DbClient,
  companyId: string,
  clientInvoiceId: string
) {
  const agg = await db.contractingCertificateAllocation.aggregate({
    where: {
      companyId,
      clientInvoiceId,
      cashTransaction: ACTIVE_CASH_WHERE,
    },
    _sum: { allocatedAmount: true },
  });
  return roundTo4(Number(agg._sum.allocatedAmount ?? 0));
}

async function sumSubcontractInvoiceAllocations(
  db: DbClient,
  companyId: string,
  subcontractInvoiceId: string
) {
  const agg = await db.contractingCertificateAllocation.aggregate({
    where: {
      companyId,
      subcontractInvoiceId,
      cashTransaction: ACTIVE_CASH_WHERE,
    },
    _sum: { allocatedAmount: true },
  });
  return roundTo4(Number(agg._sum.allocatedAmount ?? 0));
}

export async function lockClientInvoiceForSettlementInTx(
  tx: Prisma.TransactionClient,
  companyId: string,
  clientInvoiceId: string
) {
  const rows = await tx.$queryRaw<{ id: string }[]>`
    SELECT id FROM client_invoices
    WHERE id = ${clientInvoiceId} AND companyId = ${companyId}
    FOR UPDATE
  `;
  if (!rows.length) {
    throw new AppError(404, 'مستخلص المالك غير موجود');
  }
}

export async function lockSubcontractInvoiceForSettlementInTx(
  tx: Prisma.TransactionClient,
  companyId: string,
  subcontractInvoiceId: string
) {
  const rows = await tx.$queryRaw<{ id: string }[]>`
    SELECT id FROM subcontract_invoices
    WHERE id = ${subcontractInvoiceId} AND companyId = ${companyId}
    FOR UPDATE
  `;
  if (!rows.length) {
    throw new AppError(404, 'مستخلص المقاول غير موجود');
  }
}

/** Read denormalized remaining after `lock*ForSettlementInTx` (current row, not allocation snapshot). */
export async function readClientInvoiceRemainingSettlementInTx(
  tx: Prisma.TransactionClient,
  companyId: string,
  clientInvoiceId: string
) {
  const rows = await tx.$queryRaw<{ remainingSettlementAmount: unknown }[]>`
    SELECT remainingSettlementAmount FROM client_invoices
    WHERE id = ${clientInvoiceId} AND companyId = ${companyId}
  `;
  if (!rows.length) throw new AppError(404, 'مستخلص المالك غير موجود');
  return roundTo4(Number(rows[0].remainingSettlementAmount ?? 0));
}

export async function readSubcontractInvoiceRemainingSettlementInTx(
  tx: Prisma.TransactionClient,
  companyId: string,
  subcontractInvoiceId: string
) {
  const rows = await tx.$queryRaw<{ remainingSettlementAmount: unknown }[]>`
    SELECT remainingSettlementAmount FROM subcontract_invoices
    WHERE id = ${subcontractInvoiceId} AND companyId = ${companyId}
  `;
  if (!rows.length) throw new AppError(404, 'مستخلص المقاول غير موجود');
  return roundTo4(Number(rows[0].remainingSettlementAmount ?? 0));
}

function syncClientInvoiceStatusCache(
  currentStatus: string,
  settlementStatus: ContractingSettlementStatus
): string | undefined {
  if (settlementStatus === 'SETTLED' && currentStatus === 'FINANCE_POSTED') {
    return 'PAID';
  }
  if (settlementStatus !== 'SETTLED' && currentStatus === 'PAID') {
    return 'FINANCE_POSTED';
  }
  return undefined;
}

function syncSubInvoiceStatusCache(
  currentStatus: string,
  settlementStatus: ContractingSettlementStatus
): string | undefined {
  if (settlementStatus === 'SETTLED' && currentStatus === 'FINANCE_POSTED') {
    return 'PAID';
  }
  if (settlementStatus !== 'SETTLED' && currentStatus === 'PAID') {
    return 'FINANCE_POSTED';
  }
  return undefined;
}

export async function refreshClientInvoiceSettlementInTx(
  tx: Prisma.TransactionClient,
  companyId: string,
  clientInvoiceId: string
) {
  const invoice = await tx.clientInvoice.findFirst({
    where: { id: clientInvoiceId, companyId },
    select: {
      netPayableByClient: true,
      status: true,
    },
  });
  if (!invoice) throw new AppError(404, 'مستخلص المالك غير موجود');

  if (invoice.status === 'REVERSED') {
    return {
      eligibleAmount: roundTo4(Number(invoice.netPayableByClient)),
      collectedAmount: 0,
      remainingSettlementAmount: 0,
      settlementStatus: 'UNPAID' as ContractingSettlementStatus,
    };
  }

  const eligibleAmount = roundTo4(Number(invoice.netPayableByClient));
  const collectedAmount = await sumClientInvoiceAllocations(tx, companyId, clientInvoiceId);
  const remainingSettlementAmount = roundTo4(Math.max(eligibleAmount - collectedAmount, 0));
  const settlementStatus = deriveContractingSettlementStatus(collectedAmount, eligibleAmount);
  const nextStatus = syncClientInvoiceStatusCache(invoice.status, settlementStatus);

  await tx.clientInvoice.update({
    where: { id: clientInvoiceId },
    data: {
      collectedAmount: new Decimal(collectedAmount),
      remainingSettlementAmount: new Decimal(remainingSettlementAmount),
      settlementStatus,
      ...(nextStatus ? { status: nextStatus as typeof invoice.status } : {}),
    },
  });

  return {
    eligibleAmount,
    collectedAmount,
    remainingSettlementAmount,
    settlementStatus,
  };
}

export async function refreshSubcontractInvoiceSettlementInTx(
  tx: Prisma.TransactionClient,
  companyId: string,
  subcontractInvoiceId: string
) {
  const invoice = await tx.subcontractInvoice.findFirst({
    where: { id: subcontractInvoiceId, companyId },
    select: {
      netPayableAmount: true,
      status: true,
    },
  });
  if (!invoice) throw new AppError(404, 'مستخلص المقاول غير موجود');

  if (invoice.status === 'REVERSED') {
    return {
      eligibleAmount: roundTo4(Number(invoice.netPayableAmount)),
      paidAmount: 0,
      remainingSettlementAmount: 0,
      settlementStatus: 'UNPAID' as ContractingSettlementStatus,
    };
  }

  const eligibleAmount = roundTo4(Number(invoice.netPayableAmount));
  const paidSettlementAmount = await sumSubcontractInvoiceAllocations(
    tx,
    companyId,
    subcontractInvoiceId
  );
  const remainingSettlementAmount = roundTo4(Math.max(eligibleAmount - paidSettlementAmount, 0));
  const settlementStatus = deriveContractingSettlementStatus(paidSettlementAmount, eligibleAmount);
  const nextStatus = syncSubInvoiceStatusCache(invoice.status, settlementStatus);

  await tx.subcontractInvoice.update({
    where: { id: subcontractInvoiceId },
    data: {
      paidSettlementAmount: new Decimal(paidSettlementAmount),
      remainingSettlementAmount: new Decimal(remainingSettlementAmount),
      settlementStatus,
      ...(nextStatus ? { status: nextStatus as typeof invoice.status } : {}),
    },
  });

  return {
    eligibleAmount,
    paidAmount: paidSettlementAmount,
    remainingSettlementAmount,
    settlementStatus,
  };
}

export async function refreshByCashTransactionInTx(
  tx: Prisma.TransactionClient,
  companyId: string,
  cashTransactionId: string
) {
  const rows = await tx.contractingCertificateAllocation.findMany({
    where: { companyId, cashTransactionId },
    select: { clientInvoiceId: true, subcontractInvoiceId: true },
  });
  const clientIds = new Set<string>();
  const subIds = new Set<string>();
  for (const row of rows) {
    if (row.clientInvoiceId) clientIds.add(row.clientInvoiceId);
    if (row.subcontractInvoiceId) subIds.add(row.subcontractInvoiceId);
  }
  for (const id of clientIds) {
    await refreshClientInvoiceSettlementInTx(tx, companyId, id);
  }
  for (const id of subIds) {
    await refreshSubcontractInvoiceSettlementInTx(tx, companyId, id);
  }
}

export async function getCashTransactionUnappliedForContractingInTx(
  tx: Prisma.TransactionClient,
  companyId: string,
  cashTransactionId: string
) {
  const cash = await tx.cashTransaction.findFirst({
    where: { id: cashTransactionId, companyId },
    select: { amount: true, isPosted: true, isCancelled: true },
  });
  if (!cash) throw new AppError(404, 'السند غير موجود');
  if (!cash.isPosted || cash.isCancelled) {
    throw new AppError(422, 'لا يمكن تخصيص سند غير مرحّل أو ملغى');
  }

  const [m5Agg, contractingAgg] = await Promise.all([
    tx.paymentAllocation.aggregate({
      where: { companyId, cashTransactionId },
      _sum: { allocatedAmount: true },
    }),
    tx.contractingCertificateAllocation.aggregate({
      where: { companyId, cashTransactionId },
      _sum: { allocatedAmount: true },
    }),
  ]);

  const applied = roundTo4(
    Number(m5Agg._sum.allocatedAmount ?? 0) + Number(contractingAgg._sum.allocatedAmount ?? 0)
  );
  return roundTo4(Math.max(Number(cash.amount) - applied, 0));
}

export async function countActiveClientInvoiceSettlementsInTx(
  tx: Prisma.TransactionClient,
  companyId: string,
  clientInvoiceId: string
) {
  return tx.contractingCertificateAllocation.count({
    where: {
      companyId,
      clientInvoiceId,
      cashTransaction: ACTIVE_CASH_WHERE,
    },
  });
}

export async function countActiveSubcontractInvoiceSettlementsInTx(
  tx: Prisma.TransactionClient,
  companyId: string,
  subcontractInvoiceId: string
) {
  return tx.contractingCertificateAllocation.count({
    where: {
      companyId,
      subcontractInvoiceId,
      cashTransaction: ACTIVE_CASH_WHERE,
    },
  });
}

export const contractingCertificateBalanceService = {
  refreshClientInvoiceSettlementInTx,
  refreshSubcontractInvoiceSettlementInTx,
  refreshByCashTransactionInTx,
  lockClientInvoiceForSettlementInTx,
  lockSubcontractInvoiceForSettlementInTx,
  getCashTransactionUnappliedForContractingInTx,
  countActiveClientInvoiceSettlementsInTx,
  countActiveSubcontractInvoiceSettlementsInTx,
  sumClientInvoiceAllocations,
  sumSubcontractInvoiceAllocations,
};
