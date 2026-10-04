import type { BOQItemUnit, ContractVariationChangeType, Prisma } from '@prisma/client';
import { AppError } from '../../../shared/middleware/error-handler';
import {
  ClientContractInactiveError,
  ClientContractNotFoundError,
} from '../client-billing/errors/client-billing-domain.errors';
import { money, moneyZero, sumMoney } from '../utils/money-decimal';
import {
  loadApprovedOwnerVariationLinesInTx,
  loadApprovedSubcontractVariationLinesInTx,
  resolveEffectiveOwnerBoqQuantityFromBase,
  resolveEffectiveOwnerBoqRateFromLines,
  resolveEffectiveSubcontractBoqQuantityFromBase,
  resolveEffectiveSubcontractBoqRateFromLines,
} from './contract-variation-effective.service';

type Db = Prisma.TransactionClient;

export type OwnerVariationLineInput = {
  changeType: ContractVariationChangeType;
  projectBOQItemId?: string | null;
  itemCodeSnapshot: string;
  descriptionArSnapshot: string;
  unitSnapshot: string;
  quantityDelta?: number;
  approvedRate?: number | null;
  notes?: string | null;
};

export type SubcontractVariationLineInput = {
  changeType: ContractVariationChangeType;
  subcontractBOQItemId?: string | null;
  itemCodeSnapshot: string;
  descriptionArSnapshot: string;
  unitSnapshot: string;
  quantityDelta?: number;
  approvedRate?: number | null;
  notes?: string | null;
};

export type CalculatedOwnerVariationLine = {
  changeType: ContractVariationChangeType;
  projectBOQItemId: string | null;
  itemCodeSnapshot: string;
  descriptionArSnapshot: string;
  unitSnapshot: string;
  originalQuantity: ReturnType<typeof money>;
  quantityDelta: ReturnType<typeof money>;
  effectiveQuantityAfter: ReturnType<typeof money> | null;
  originalRate: ReturnType<typeof money>;
  approvedRate: ReturnType<typeof money> | null;
  rateDelta: ReturnType<typeof money> | null;
  amountImpact: ReturnType<typeof money>;
  notes: string | null;
};

export type CalculatedOwnerVariation = {
  lines: CalculatedOwnerVariationLine[];
  increaseValue: ReturnType<typeof money>;
  decreaseValue: ReturnType<typeof money>;
  netImpact: ReturnType<typeof money>;
  originalContractValueSnapshot: ReturnType<typeof money>;
  revisedContractValuePreview: ReturnType<typeof money>;
};

export type CalculatedSubcontractVariation = {
  lines: CalculatedOwnerVariationLine[];
  increaseValue: ReturnType<typeof money>;
  decreaseValue: ReturnType<typeof money>;
  netImpact: ReturnType<typeof money>;
  originalContractValueSnapshot: ReturnType<typeof money>;
  revisedContractValuePreview: ReturnType<typeof money>;
};

export class ContractVariationCalculationService {
  async previewOwnerInTx(
    db: Db,
    companyId: string,
    clientContractId: string,
    input: { lines: OwnerVariationLineInput[]; excludeVariationOrderId?: string }
  ): Promise<CalculatedOwnerVariation> {
    const contract = await db.clientContract.findFirst({ where: { id: clientContractId, companyId } });
    if (!contract) throw new ClientContractNotFoundError(companyId, clientContractId);
    if (contract.status !== 'ACTIVE') throw new ClientContractInactiveError(contract.id, contract.status);

    const approvedLines = await loadApprovedOwnerVariationLinesInTx(db, companyId, clientContractId, {
      excludeVariationOrderId: input.excludeVariationOrderId,
    });

    const boqItems = await db.projectBOQItem.findMany({
      where: { companyId, projectId: contract.projectId },
    });
    const boqById = new Map(boqItems.map((b) => [b.id, b]));

    const calculatedLines: CalculatedOwnerVariationLine[] = [];
    const pendingQtyByItem = new Map<string, ReturnType<typeof money>>();

    for (const row of input.lines) {
      calculatedLines.push(
        this.calculateOwnerLine(row, boqById, approvedLines, pendingQtyByItem, input.excludeVariationOrderId)
      );
    }

    const totals = summarizeLineImpacts(calculatedLines.map((l) => l.amountImpact));
    const priorApprovedNet = await sumApprovedOwnerNetImpactInTx(db, companyId, clientContractId, {
      excludeVariationOrderId: input.excludeVariationOrderId,
    });
    const originalContractValueSnapshot = money(contract.totalContractValue);
    const revisedContractValuePreview = money(originalContractValueSnapshot.plus(priorApprovedNet).plus(totals.netImpact));

    return {
      lines: calculatedLines,
      increaseValue: totals.increaseValue,
      decreaseValue: totals.decreaseValue,
      netImpact: totals.netImpact,
      originalContractValueSnapshot,
      revisedContractValuePreview,
    };
  }

  async previewSubcontractInTx(
    db: Db,
    companyId: string,
    subcontractId: string,
    input: { lines: SubcontractVariationLineInput[]; excludeVariationOrderId?: string }
  ): Promise<CalculatedSubcontractVariation> {
    const subcontract = await db.subcontract.findFirst({
      where: { id: subcontractId, companyId },
      include: { boqItems: true },
    });
    if (!subcontract) throw new AppError(404, 'عقد الباطن غير موجود');

    const approvedLines = await loadApprovedSubcontractVariationLinesInTx(db, companyId, subcontractId, {
      excludeVariationOrderId: input.excludeVariationOrderId,
    });
    const boqById = new Map(subcontract.boqItems.map((b) => [b.id, b]));
    const calculatedLines: CalculatedOwnerVariationLine[] = [];
    const pendingQtyByItem = new Map<string, ReturnType<typeof money>>();

    for (const row of input.lines) {
      calculatedLines.push(
        this.calculateSubcontractLine(row, boqById, approvedLines, pendingQtyByItem)
      );
    }

    const totals = summarizeLineImpacts(calculatedLines.map((l) => l.amountImpact));
    const priorApprovedNet = await sumApprovedSubcontractNetImpactInTx(db, companyId, subcontractId, {
      excludeVariationOrderId: input.excludeVariationOrderId,
    });
    const originalContractValueSnapshot = money(subcontract.totalContractValue);
    const revisedContractValuePreview = money(originalContractValueSnapshot.plus(priorApprovedNet).plus(totals.netImpact));

    return {
      lines: calculatedLines,
      increaseValue: totals.increaseValue,
      decreaseValue: totals.decreaseValue,
      netImpact: totals.netImpact,
      originalContractValueSnapshot,
      revisedContractValuePreview,
    };
  }

  private calculateOwnerLine(
    row: OwnerVariationLineInput,
    boqById: Map<string, { id: string; contractQuantity: Prisma.Decimal; unitSellingPrice: Prisma.Decimal }>,
    approvedLines: Awaited<ReturnType<typeof loadApprovedOwnerVariationLinesInTx>>,
    pendingQtyByItem: Map<string, ReturnType<typeof money>>,
    _excludeId?: string
  ): CalculatedOwnerVariationLine {
    const quantityDelta = money(row.quantityDelta ?? 0);
    let originalQuantity = moneyZero();
    let originalRate = moneyZero();
    let projectBOQItemId: string | null = row.projectBOQItemId ?? null;

    if (row.changeType === 'NEW_ITEM') {
      if (row.approvedRate == null) throw new AppError(400, 'سعر البند الجديد مطلوب');
      originalRate = money(row.approvedRate);
      const qty = quantityDelta;
      const amountImpact = money(qty.mul(originalRate));
      return {
        changeType: row.changeType,
        projectBOQItemId: null,
        itemCodeSnapshot: row.itemCodeSnapshot,
        descriptionArSnapshot: row.descriptionArSnapshot,
        unitSnapshot: row.unitSnapshot,
        originalQuantity: moneyZero(),
        quantityDelta: qty,
        effectiveQuantityAfter: qty,
        originalRate: moneyZero(),
        approvedRate: originalRate,
        rateDelta: null,
        amountImpact,
        notes: row.notes ?? null,
      };
    }

    if (!projectBOQItemId) throw new AppError(400, 'يجب تحديد بند BOQ');
    const boq = boqById.get(projectBOQItemId);
    if (!boq) throw new AppError(400, `بند BOQ غير موجود: ${projectBOQItemId}`);

    originalQuantity = money(boq.contractQuantity);
    originalRate = resolveEffectiveOwnerBoqRateFromLines(money(boq.unitSellingPrice), approvedLines, boq.id);

    const priorPending = pendingQtyByItem.get(boq.id) ?? moneyZero();
    const effectiveBefore = resolveEffectiveOwnerBoqQuantityFromBase(originalQuantity, approvedLines, boq.id);
    const effectiveAfter = money(effectiveBefore.plus(priorPending).plus(quantityDelta));
    pendingQtyByItem.set(boq.id, money(priorPending.plus(quantityDelta)));

    if (row.changeType === 'RATE_CHANGE') {
      if (row.approvedRate == null) throw new AppError(400, 'السعر المعتمد مطلوب لتغيير السعر');
      const approvedRate = money(row.approvedRate);
      const rateDelta = money(approvedRate.minus(originalRate));
      const qtyForImpact = effectiveBefore;
      const amountImpact = money(qtyForImpact.mul(rateDelta));
      return {
        changeType: row.changeType,
        projectBOQItemId,
        itemCodeSnapshot: row.itemCodeSnapshot,
        descriptionArSnapshot: row.descriptionArSnapshot,
        unitSnapshot: row.unitSnapshot,
        originalQuantity: effectiveBefore,
        quantityDelta: moneyZero(),
        effectiveQuantityAfter: effectiveBefore,
        originalRate,
        approvedRate,
        rateDelta,
        amountImpact,
        notes: row.notes ?? null,
      };
    }

    if (row.changeType === 'OMIT' && quantityDelta.gt(0)) {
      throw new AppError(400, 'حذف البند يتطلب كمية سالبة');
    }

    const rateForQty = originalRate;
    const amountImpact = money(quantityDelta.mul(rateForQty));

    return {
      changeType: row.changeType,
      projectBOQItemId,
      itemCodeSnapshot: row.itemCodeSnapshot,
      descriptionArSnapshot: row.descriptionArSnapshot,
      unitSnapshot: row.unitSnapshot,
      originalQuantity: effectiveBefore,
      quantityDelta,
      effectiveQuantityAfter: effectiveAfter.lt(0) ? moneyZero() : effectiveAfter,
      originalRate,
      approvedRate: row.approvedRate != null ? money(row.approvedRate) : null,
      rateDelta: null,
      amountImpact,
      notes: row.notes ?? null,
    };
  }

  private calculateSubcontractLine(
    row: SubcontractVariationLineInput,
    boqById: Map<string, { id: string; contractQuantity: Prisma.Decimal; unitPrice: Prisma.Decimal }>,
    approvedLines: Awaited<ReturnType<typeof loadApprovedSubcontractVariationLinesInTx>>,
    pendingQtyByItem: Map<string, ReturnType<typeof money>>
  ): CalculatedOwnerVariationLine {
    const quantityDelta = money(row.quantityDelta ?? 0);
    const subcontractBOQItemId = row.subcontractBOQItemId ?? null;

    if (row.changeType === 'NEW_ITEM') {
      if (row.approvedRate == null) throw new AppError(400, 'سعر البند الجديد مطلوب');
      const originalRate = money(row.approvedRate);
      const qty = quantityDelta;
      return {
        changeType: row.changeType,
        projectBOQItemId: null,
        itemCodeSnapshot: row.itemCodeSnapshot,
        descriptionArSnapshot: row.descriptionArSnapshot,
        unitSnapshot: row.unitSnapshot,
        originalQuantity: moneyZero(),
        quantityDelta: qty,
        effectiveQuantityAfter: qty,
        originalRate: moneyZero(),
        approvedRate: originalRate,
        rateDelta: null,
        amountImpact: money(qty.mul(originalRate)),
        notes: row.notes ?? null,
      };
    }

    if (!subcontractBOQItemId) throw new AppError(400, 'يجب تحديد بند BOQ');
    const boq = boqById.get(subcontractBOQItemId);
    if (!boq) throw new AppError(400, `بند BOQ غير موجود: ${subcontractBOQItemId}`);

    const originalQuantity = money(boq.contractQuantity);
    const originalRate = resolveEffectiveSubcontractBoqRateFromLines(money(boq.unitPrice), approvedLines, boq.id);
    const priorPending = pendingQtyByItem.get(boq.id) ?? moneyZero();
    const effectiveBefore = resolveEffectiveSubcontractBoqQuantityFromBase(originalQuantity, approvedLines, boq.id);
    const effectiveAfter = money(effectiveBefore.plus(priorPending).plus(quantityDelta));
    pendingQtyByItem.set(boq.id, money(priorPending.plus(quantityDelta)));

    if (row.changeType === 'RATE_CHANGE') {
      if (row.approvedRate == null) throw new AppError(400, 'السعر المعتمد مطلوب لتغيير السعر');
      const approvedRate = money(row.approvedRate);
      const rateDelta = money(approvedRate.minus(originalRate));
      return {
        changeType: row.changeType,
        projectBOQItemId: subcontractBOQItemId,
        itemCodeSnapshot: row.itemCodeSnapshot,
        descriptionArSnapshot: row.descriptionArSnapshot,
        unitSnapshot: row.unitSnapshot,
        originalQuantity: effectiveBefore,
        quantityDelta: moneyZero(),
        effectiveQuantityAfter: effectiveBefore,
        originalRate,
        approvedRate,
        rateDelta,
        amountImpact: money(effectiveBefore.mul(rateDelta)),
        notes: row.notes ?? null,
      };
    }

    return {
      changeType: row.changeType,
      projectBOQItemId: subcontractBOQItemId,
      itemCodeSnapshot: row.itemCodeSnapshot,
      descriptionArSnapshot: row.descriptionArSnapshot,
      unitSnapshot: row.unitSnapshot,
      originalQuantity: effectiveBefore,
      quantityDelta,
      effectiveQuantityAfter: effectiveAfter.lt(0) ? moneyZero() : effectiveAfter,
      originalRate,
      approvedRate: row.approvedRate != null ? money(row.approvedRate) : null,
      rateDelta: null,
      amountImpact: money(quantityDelta.mul(originalRate)),
      notes: row.notes ?? null,
    };
  }
}

function summarizeLineImpacts(impacts: ReturnType<typeof money>[]) {
  let increaseValue = moneyZero();
  let decreaseValue = moneyZero();
  for (const impact of impacts) {
    if (impact.gte(0)) increaseValue = money(increaseValue.plus(impact));
    else decreaseValue = money(decreaseValue.plus(impact.abs()));
  }
  const netImpact = sumMoney(impacts);
  return { increaseValue, decreaseValue, netImpact };
}

async function sumApprovedOwnerNetImpactInTx(
  db: Db,
  companyId: string,
  clientContractId: string,
  options?: { excludeVariationOrderId?: string }
) {
  const rows = await db.contractVariationOrder.findMany({
    where: {
      companyId,
      clientContractId,
      status: 'APPROVED',
      ...(options?.excludeVariationOrderId ? { id: { not: options.excludeVariationOrderId } } : {}),
    },
    select: { netImpact: true },
  });
  return sumMoney(rows.map((r) => r.netImpact));
}

async function sumApprovedSubcontractNetImpactInTx(
  db: Db,
  companyId: string,
  subcontractId: string,
  options?: { excludeVariationOrderId?: string }
) {
  const rows = await db.subcontractVariationOrder.findMany({
    where: {
      companyId,
      subcontractId,
      status: 'APPROVED',
      ...(options?.excludeVariationOrderId ? { id: { not: options.excludeVariationOrderId } } : {}),
    },
    select: { netImpact: true },
  });
  return sumMoney(rows.map((r) => r.netImpact));
}

export const contractVariationCalculationService = new ContractVariationCalculationService();

/** Map subcontract line BOQ id field for persistence */
export function mapSubLineBoqId(line: CalculatedOwnerVariationLine): string | null {
  return line.projectBOQItemId;
}

export function parseOwnerBoqUnit(unitSnapshot: string): BOQItemUnit {
  const allowed: BOQItemUnit[] = ['M2', 'M3', 'TON', 'ITEM', 'LM', 'LS'];
  const u = unitSnapshot as BOQItemUnit;
  if (!allowed.includes(u)) throw new AppError(400, `وحدة غير مدعومة: ${unitSnapshot}`);
  return u;
}
