import type { ContractVariationChangeType, Prisma } from '@prisma/client';
import type { Decimal } from '@prisma/client/runtime/library';
import { money, moneyZero } from '../utils/money-decimal';

type Db = Prisma.TransactionClient | typeof import('../../../shared/database/prisma').default;

const APPROVED_VO_STATUS = 'APPROVED' as const;

export type ApprovedOwnerVariationLine = {
  changeType: ContractVariationChangeType;
  projectBOQItemId: string | null;
  quantityDelta: Decimal;
  approvedRate: Decimal | null;
  approvedAt: Date;
  sequenceNumber: number;
};

export type ApprovedSubcontractVariationLine = {
  changeType: ContractVariationChangeType;
  subcontractBOQItemId: string | null;
  quantityDelta: Decimal;
  approvedRate: Decimal | null;
  approvedAt: Date;
  sequenceNumber: number;
};

export function sumApprovedQuantityDelta(
  lines: Array<{ projectBOQItemId?: string | null; changeType: ContractVariationChangeType; quantityDelta: Decimal }>,
  projectBOQItemId: string
): Decimal {
  let total = moneyZero();
  for (const line of lines) {
    if (line.projectBOQItemId !== projectBOQItemId) continue;
    if (line.changeType === 'QUANTITY_CHANGE' || line.changeType === 'OMIT') {
      total = money(total.plus(line.quantityDelta));
    }
  }
  return total;
}

export function sumApprovedSubcontractQuantityDelta(
  lines: Array<{ subcontractBOQItemId?: string | null; changeType: ContractVariationChangeType; quantityDelta: Decimal }>,
  subcontractBOQItemId: string
): Decimal {
  let total = moneyZero();
  for (const line of lines) {
    if (line.subcontractBOQItemId !== subcontractBOQItemId) continue;
    if (line.changeType === 'QUANTITY_CHANGE' || line.changeType === 'OMIT') {
      total = money(total.plus(line.quantityDelta));
    }
  }
  return total;
}

/**
 * Effective unit rate = original `unitSellingPrice`, then each APPROVED `RATE_CHANGE` line's
 * `approvedRate` applied in chronological approval order (effective from approval forward).
 * Historical preliminary certificate snapshots are not rewritten.
 */
export function resolveEffectiveOwnerBoqRateFromLines(
  originalUnitSellingPrice: Decimal,
  lines: ApprovedOwnerVariationLine[],
  projectBOQItemId: string
): Decimal {
  let rate = money(originalUnitSellingPrice);
  const rateChanges = lines
    .filter((l) => l.projectBOQItemId === projectBOQItemId && l.changeType === 'RATE_CHANGE' && l.approvedRate != null)
    .sort((a, b) => sortByApprovalChronology(a, b));
  for (const change of rateChanges) {
    rate = money(change.approvedRate!);
  }
  return rate;
}

export function resolveEffectiveSubcontractBoqRateFromLines(
  originalUnitPrice: Decimal,
  lines: ApprovedSubcontractVariationLine[],
  subcontractBOQItemId: string
): Decimal {
  let unitPrice = money(originalUnitPrice);
  const rateChanges = lines
    .filter(
      (l) => l.subcontractBOQItemId === subcontractBOQItemId && l.changeType === 'RATE_CHANGE' && l.approvedRate != null
    )
    .sort((a, b) => sortByApprovalChronology(a, b));
  for (const change of rateChanges) {
    unitPrice = money(change.approvedRate!);
  }
  return unitPrice;
}

export function resolveEffectiveOwnerBoqQuantityFromBase(
  baseContractQuantity: Decimal,
  lines: ApprovedOwnerVariationLine[],
  projectBOQItemId: string
): Decimal {
  const delta = sumApprovedQuantityDelta(lines, projectBOQItemId);
  const effective = money(baseContractQuantity.plus(delta));
  return effective.lt(0) ? moneyZero() : effective;
}

export function resolveEffectiveSubcontractBoqQuantityFromBase(
  baseContractQuantity: Decimal,
  lines: ApprovedSubcontractVariationLine[],
  subcontractBOQItemId: string
): Decimal {
  const delta = sumApprovedSubcontractQuantityDelta(lines, subcontractBOQItemId);
  const effective = money(baseContractQuantity.plus(delta));
  return effective.lt(0) ? moneyZero() : effective;
}

export async function loadApprovedOwnerVariationLinesInTx(
  db: Db,
  companyId: string,
  clientContractId: string,
  options?: { excludeVariationOrderId?: string; includePendingOrderId?: string }
): Promise<ApprovedOwnerVariationLine[]> {
  const orders = await db.contractVariationOrder.findMany({
    where: {
      companyId,
      clientContractId,
      status: APPROVED_VO_STATUS,
      ...(options?.excludeVariationOrderId ? { id: { not: options.excludeVariationOrderId } } : {}),
    },
    include: { lines: true },
    orderBy: [{ approvedAt: 'asc' }, { sequenceNumber: 'asc' }],
  });

  const rows: ApprovedOwnerVariationLine[] = [];
  for (const order of orders) {
    const approvedAt = order.approvedAt ?? order.updatedAt;
    for (const line of order.lines) {
      rows.push({
        changeType: line.changeType,
        projectBOQItemId: line.projectBOQItemId,
        quantityDelta: money(line.quantityDelta),
        approvedRate: line.approvedRate != null ? money(line.approvedRate) : null,
        approvedAt,
        sequenceNumber: order.sequenceNumber,
      });
    }
  }

  if (options?.includePendingOrderId) {
    const pending = await db.contractVariationOrder.findFirst({
      where: { id: options.includePendingOrderId, companyId, clientContractId },
      include: { lines: true },
    });
    if (pending) {
      const pseudoApprovedAt = new Date('9999-12-31T23:59:59.999Z');
      for (const line of pending.lines) {
        rows.push({
          changeType: line.changeType,
          projectBOQItemId: line.projectBOQItemId,
          quantityDelta: money(line.quantityDelta),
          approvedRate: line.approvedRate != null ? money(line.approvedRate) : null,
          approvedAt: pseudoApprovedAt,
          sequenceNumber: pending.sequenceNumber,
        });
      }
    }
  }

  return rows;
}

export async function loadApprovedSubcontractVariationLinesInTx(
  db: Db,
  companyId: string,
  subcontractId: string,
  options?: { excludeVariationOrderId?: string; includePendingOrderId?: string }
): Promise<ApprovedSubcontractVariationLine[]> {
  const orders = await db.subcontractVariationOrder.findMany({
    where: {
      companyId,
      subcontractId,
      status: APPROVED_VO_STATUS,
      ...(options?.excludeVariationOrderId ? { id: { not: options.excludeVariationOrderId } } : {}),
    },
    include: { lines: true },
    orderBy: [{ approvedAt: 'asc' }, { sequenceNumber: 'asc' }],
  });

  const rows: ApprovedSubcontractVariationLine[] = [];
  for (const order of orders) {
    const approvedAt = order.approvedAt ?? order.updatedAt;
    for (const line of order.lines) {
      rows.push({
        changeType: line.changeType,
        subcontractBOQItemId: line.subcontractBOQItemId,
        quantityDelta: money(line.quantityDelta),
        approvedRate: line.approvedRate != null ? money(line.approvedRate) : null,
        approvedAt,
        sequenceNumber: order.sequenceNumber,
      });
    }
  }

  if (options?.includePendingOrderId) {
    const pending = await db.subcontractVariationOrder.findFirst({
      where: { id: options.includePendingOrderId, companyId, subcontractId },
      include: { lines: true },
    });
    if (pending) {
      const pseudoApprovedAt = new Date('9999-12-31T23:59:59.999Z');
      for (const line of pending.lines) {
        rows.push({
          changeType: line.changeType,
          subcontractBOQItemId: line.subcontractBOQItemId,
          quantityDelta: money(line.quantityDelta),
          approvedRate: line.approvedRate != null ? money(line.approvedRate) : null,
          approvedAt: pseudoApprovedAt,
          sequenceNumber: pending.sequenceNumber,
        });
      }
    }
  }

  return rows;
}

export async function resolveEffectiveOwnerBoqQuantityInTx(
  db: Db,
  companyId: string,
  clientContractId: string,
  projectBOQItemId: string,
  options?: { excludeVariationOrderId?: string; includePendingOrderId?: string }
): Promise<Decimal> {
  const boq = await db.projectBOQItem.findFirst({
    where: { id: projectBOQItemId, companyId },
  });
  if (!boq) return moneyZero();
  const lines = await loadApprovedOwnerVariationLinesInTx(db, companyId, clientContractId, options);
  return resolveEffectiveOwnerBoqQuantityFromBase(money(boq.contractQuantity), lines, projectBOQItemId);
}

export async function resolveEffectiveOwnerBoqRateInTx(
  db: Db,
  companyId: string,
  clientContractId: string,
  projectBOQItemId: string,
  options?: { excludeVariationOrderId?: string; includePendingOrderId?: string }
): Promise<Decimal> {
  const boq = await db.projectBOQItem.findFirst({
    where: { id: projectBOQItemId, companyId },
  });
  if (!boq) return moneyZero();
  const lines = await loadApprovedOwnerVariationLinesInTx(db, companyId, clientContractId, options);
  return resolveEffectiveOwnerBoqRateFromLines(money(boq.unitSellingPrice), lines, projectBOQItemId);
}

export async function resolveEffectiveSubcontractBoqQuantityInTx(
  db: Db,
  companyId: string,
  subcontractId: string,
  subcontractBOQItemId: string,
  options?: { excludeVariationOrderId?: string; includePendingOrderId?: string }
): Promise<Decimal> {
  const boq = await db.subcontractBOQItem.findFirst({
    where: { id: subcontractBOQItemId, subcontract: { companyId } },
  });
  if (!boq) return moneyZero();
  const lines = await loadApprovedSubcontractVariationLinesInTx(db, companyId, subcontractId, options);
  return resolveEffectiveSubcontractBoqQuantityFromBase(money(boq.contractQuantity), lines, subcontractBOQItemId);
}

export async function resolveEffectiveSubcontractBoqRateInTx(
  db: Db,
  companyId: string,
  subcontractId: string,
  subcontractBOQItemId: string,
  options?: { excludeVariationOrderId?: string; includePendingOrderId?: string }
): Promise<Decimal> {
  const boq = await db.subcontractBOQItem.findFirst({
    where: { id: subcontractBOQItemId, subcontract: { companyId, id: subcontractId } },
  });
  if (!boq) return moneyZero();
  const lines = await loadApprovedSubcontractVariationLinesInTx(db, companyId, subcontractId, options);
  return resolveEffectiveSubcontractBoqRateFromLines(money(boq.unitPrice), lines, subcontractBOQItemId);
}

/** Canonical subcontract qty/rate caps for financial invoices and preliminary (approved VO only). */
export async function resolveSubcontractBoqCertificationLimitsInTx(
  db: Db,
  companyId: string,
  subcontractId: string,
  subcontractBOQItemId: string,
  options?: { excludeVariationOrderId?: string; includePendingOrderId?: string }
) {
  const boq = await db.subcontractBOQItem.findFirst({
    where: { id: subcontractBOQItemId, subcontract: { companyId, id: subcontractId } },
  });
  if (!boq) {
    return {
      effectiveContractQuantity: moneyZero(),
      maxAllowedQuantity: moneyZero(),
      unitPrice: moneyZero(),
    };
  }
  const approvedLines = await loadApprovedSubcontractVariationLinesInTx(
    db,
    companyId,
    subcontractId,
    options
  );
  const qtyDelta = sumApprovedSubcontractQuantityDelta(approvedLines, boq.id);
  const effectiveContractQuantity = resolveEffectiveSubcontractBoqQuantityFromBase(
    money(boq.contractQuantity),
    approvedLines,
    boq.id
  );
  const maxAllowedQuantity = money(money(boq.maxAllowedQuantity).plus(qtyDelta));
  const unitPrice = resolveEffectiveSubcontractBoqRateFromLines(
    money(boq.unitPrice),
    approvedLines,
    boq.id
  );
  return { effectiveContractQuantity, maxAllowedQuantity, unitPrice };
}

export async function isOwnerBoqItemCertifiableInTx(
  db: Db,
  companyId: string,
  projectBOQItemId: string
): Promise<boolean> {
  const boq = await db.projectBOQItem.findFirst({
    where: { id: projectBOQItemId, companyId },
  });
  if (!boq) return false;
  if (boq.origin === 'BASE_CONTRACT') return true;
  if (!boq.sourceVariationOrderId) return false;
  const vo = await db.contractVariationOrder.findFirst({
    where: { id: boq.sourceVariationOrderId, companyId, status: APPROVED_VO_STATUS },
    select: { id: true },
  });
  return !!vo;
}

function sortByApprovalChronology(
  a: { approvedAt: Date; sequenceNumber: number },
  b: { approvedAt: Date; sequenceNumber: number }
) {
  const t = a.approvedAt.getTime() - b.approvedAt.getTime();
  if (t !== 0) return t;
  return a.sequenceNumber - b.sequenceNumber;
}
