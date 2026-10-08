import prisma from '../../../shared/database/prisma';
import { AppError } from '../../../shared/middleware/error-handler';

export type WorkOrderBomPlanRow = { bomId: string; modelCount: number };

export type WorkOrderBomProgressRow = {
  bomId: string;
  bomName: string;
  requiredQuantity: number;
  completedQuantity: number;
  inProgressQuantity: number;
  /** مسودات أوامر تصنيع محجوزة على هذا النموذج */
  draftQuantity: number;
  /** أدنى كمية مسموحة في الخطة = منفّذ + قيد التنفيذ + مسودات */
  minimumModelQuantity: number;
  remainingQuantity: number;
  percentComplete: number;
};

export type WorkOrderProgressSnapshot = {
  workOrderId: string;
  requiredTotal: number;
  completedTotal: number;
  inProgressTotal: number;
  remainingTotal: number;
  percentComplete: number;
  productionOrderCount: number;
  bomRows: WorkOrderBomProgressRow[];
  canFinish: boolean;
};

function num(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

export function parseBomPlansFromMetadata(
  processMetadata: unknown,
  legacyBomId: string | null | undefined,
  legacyModelQuantity: unknown
): WorkOrderBomPlanRow[] {
  const meta = processMetadata as { bomPlans?: Array<{ bomId?: string; modelCount?: number }> } | null;
  const fromMeta = (meta?.bomPlans ?? [])
    .map((row) => {
      const bomId = String(row.bomId ?? '').trim();
      const modelCount = num(row.modelCount);
      if (!bomId || modelCount <= 0) return null;
      return { bomId, modelCount };
    })
    .filter(Boolean) as WorkOrderBomPlanRow[];

  if (fromMeta.length > 0) return normalizeBomPlans(fromMeta);
  const bomId = legacyBomId?.trim();
  const qty = num(legacyModelQuantity);
  if (bomId && qty > 0) return [{ bomId, modelCount: qty }];
  return [];
}

/** يجمع صفوفاً متكررة لنفس النموذج (مثلاً سطران لنفس الصنف التام). */
export function normalizeBomPlans(plans: WorkOrderBomPlanRow[]): WorkOrderBomPlanRow[] {
  const byBom = new Map<string, number>();
  for (const p of plans) {
    byBom.set(p.bomId, (byBom.get(p.bomId) ?? 0) + p.modelCount);
  }
  return [...byBom.entries()].map(([bomId, modelCount]) => ({ bomId, modelCount }));
}

async function bomPlansFromWorkOrderLines(
  companyId: string,
  lines: Array<{ itemId: string; plannedQuantity: unknown }>
): Promise<WorkOrderBomPlanRow[]> {
  const byBom = new Map<string, number>();
  for (const line of lines) {
    const qty = num(line.plannedQuantity);
    if (qty <= 0) continue;
    const bom = await prisma.billOfMaterials.findFirst({
      where: { companyId, finishedItemId: line.itemId, isActive: true },
      select: { id: true },
      orderBy: { updatedAt: 'desc' },
    });
    if (!bom) continue;
    byBom.set(bom.id, (byBom.get(bom.id) ?? 0) + qty);
  }
  return [...byBom.entries()].map(([bomId, modelCount]) => ({ bomId, modelCount }));
}

export async function computeWorkOrderProgress(
  companyId: string,
  workOrderId: string
): Promise<WorkOrderProgressSnapshot | null> {
  const wo = await prisma.manufacturingWorkOrder.findFirst({
    where: { id: workOrderId, companyId },
    select: {
      id: true,
      bomId: true,
      modelQuantity: true,
      processMetadata: true,
      lines: {
        select: { itemId: true, plannedQuantity: true },
        orderBy: { lineOrder: 'asc' },
      },
    },
  });
  if (!wo) return null;

  const fromMeta = parseBomPlansFromMetadata(wo.processMetadata, wo.bomId, wo.modelQuantity);
  const fromLines = await bomPlansFromWorkOrderLines(companyId, wo.lines);
  // التخطيط المحفوظ (bomPlans) يطابق شاشة التخطيط الإنتاجي؛ بنود الشغل احتياط عند غياب الخطة.
  const plans =
    fromMeta.length > 0 ? fromMeta : fromLines.length > 0 ? fromLines : [];
  if (!plans.length) {
    return {
      workOrderId: wo.id,
      requiredTotal: 0,
      completedTotal: 0,
      inProgressTotal: 0,
      remainingTotal: 0,
      percentComplete: 0,
      productionOrderCount: 0,
      bomRows: [],
      canFinish: false,
    };
  }

  const bomIds = [...new Set(plans.map((p) => p.bomId))];
  const boms = await prisma.billOfMaterials.findMany({
    where: { companyId, id: { in: bomIds } },
    select: { id: true, name: true },
  });
  const bomNameById = new Map(boms.map((b) => [b.id, b.name]));

  const orders = await prisma.productionOrder.findMany({
    where: { companyId, manufacturingWorkOrderId: workOrderId },
    select: {
      bomId: true,
      status: true,
      plannedQuantity: true,
      actualQuantity: true,
      materialsIssueJournalEntryId: true,
      completionJournalEntryId: true,
    },
  });

  const completedByBom = new Map<string, number>();
  const inProgressByBom = new Map<string, number>();
  const draftByBom = new Map<string, number>();
  for (const o of orders) {
    if (o.status === 'DRAFT') {
      draftByBom.set(o.bomId, (draftByBom.get(o.bomId) ?? 0) + num(o.plannedQuantity));
      continue;
    }
    const planned = num(o.plannedQuantity);
    const completedQty = num(o.actualQuantity ?? o.plannedQuantity);
    const countsCompleted =
      o.status === 'COMPLETED' ||
      (o.status === 'CANCELLED' && Boolean(o.completionJournalEntryId));
    const countsInProgress =
      !countsCompleted &&
      (o.status === 'IN_PROGRESS' ||
        o.status === 'RELEASED' ||
        (o.status === 'CANCELLED' &&
          Boolean(o.materialsIssueJournalEntryId) &&
          !o.completionJournalEntryId));

    if (countsCompleted) {
      completedByBom.set(o.bomId, (completedByBom.get(o.bomId) ?? 0) + completedQty);
    } else if (countsInProgress) {
      inProgressByBom.set(o.bomId, (inProgressByBom.get(o.bomId) ?? 0) + planned);
    }
  }

  const bomRows: WorkOrderBomProgressRow[] = plans.map((plan) => {
    const requiredQuantity = plan.modelCount;
    const completedQuantity = completedByBom.get(plan.bomId) ?? 0;
    const inProgressQuantity = inProgressByBom.get(plan.bomId) ?? 0;
    const draftQuantity = draftByBom.get(plan.bomId) ?? 0;
    const minimumModelQuantity = completedQuantity + inProgressQuantity + draftQuantity;
    const remainingQuantity = Math.max(0, requiredQuantity - completedQuantity);
    const percentComplete =
      requiredQuantity > 0
        ? Math.min(100, Math.round((completedQuantity / requiredQuantity) * 1000) / 10)
        : 0;
    return {
      bomId: plan.bomId,
      bomName: bomNameById.get(plan.bomId) ?? plan.bomId,
      requiredQuantity,
      completedQuantity,
      inProgressQuantity,
      draftQuantity,
      minimumModelQuantity,
      remainingQuantity,
      percentComplete,
    };
  });

  const requiredTotal = bomRows.reduce((s, r) => s + r.requiredQuantity, 0);
  const completedTotal = bomRows.reduce((s, r) => s + r.completedQuantity, 0);
  const inProgressTotal = bomRows.reduce((s, r) => s + r.inProgressQuantity, 0);
  const remainingTotal = bomRows.reduce((s, r) => s + r.remainingQuantity, 0);
  const percentComplete =
    requiredTotal > 0
      ? Math.min(100, Math.round((completedTotal / requiredTotal) * 1000) / 10)
      : 0;

  const canFinish =
    requiredTotal > 0 &&
    bomRows.every((r) => r.completedQuantity >= r.requiredQuantity - 1e-6);

  return {
    workOrderId: wo.id,
    requiredTotal,
    completedTotal,
    inProgressTotal,
    remainingTotal,
    percentComplete,
    productionOrderCount: orders.length,
    bomRows,
    canFinish,
  };
}

export function minimumModelCountForBomProgress(row: {
  completedQuantity: number;
  inProgressQuantity: number;
  draftQuantity?: number;
}): number {
  return row.completedQuantity + row.inProgressQuantity + (row.draftQuantity ?? 0);
}

/** يتحقق من خطة التخطيط عند حفظ أمر الشغل (كميات وإزالة نماذج). */
export async function assertWorkOrderPlanningSave(
  companyId: string,
  workOrderId: string,
  incomingPlans: WorkOrderBomPlanRow[]
) {
  const progress = await computeWorkOrderProgress(companyId, workOrderId);
  if (!progress) return;

  const incomingByBom = new Map<string, number>();
  for (const p of normalizeBomPlans(incomingPlans)) {
    incomingByBom.set(p.bomId, p.modelCount);
  }

  for (const row of progress.bomRows) {
    const nextQty = incomingByBom.get(row.bomId);
    if (nextQty === undefined) {
      if (row.completedQuantity > 0 || row.inProgressQuantity > 0) {
        throw new AppError(
          422,
          `لا يمكن حذف النموذج «${row.bomName}» — يوجد كمية منفّذة أو قيد التنفيذ`
        );
      }
      const openOrders = await prisma.productionOrder.count({
        where: {
          companyId,
          manufacturingWorkOrderId: workOrderId,
          bomId: row.bomId,
          status: { in: ['DRAFT', 'RELEASED', 'IN_PROGRESS'] },
        },
      });
      if (openOrders > 0) {
        throw new AppError(
          422,
          `لا يمكن حذف النموذج «${row.bomName}» — يوجد أوامر تصنيع في قائمة التنفيذ`
        );
      }
      continue;
    }

    const floor = minimumModelCountForBomProgress(row);
    if (nextQty < floor - 1e-6) {
      throw new AppError(
        422,
        `كمية النموذج «${row.bomName}» لا يمكن أن تقل عن المنفّذ + قيد التنفيذ (${floor})`
      );
    }
  }
}

export async function assertProductionOrderQuantityWithinWorkOrderCap(
  companyId: string,
  workOrderId: string,
  bomId: string,
  plannedQuantity: number,
  excludeOrderId?: string
) {
  const progress = await computeWorkOrderProgress(companyId, workOrderId);
  const row = progress?.bomRows.find((r) => r.bomId === bomId);
  if (!row) return;

  let otherInProgress = row.inProgressQuantity;
  if (excludeOrderId) {
    const cur = await prisma.productionOrder.findFirst({
      where: { id: excludeOrderId, companyId },
      select: { status: true, plannedQuantity: true, bomId: true },
    });
    if (
      cur &&
      cur.bomId === bomId &&
      (cur.status === 'RELEASED' || cur.status === 'IN_PROGRESS')
    ) {
      otherInProgress = Math.max(0, otherInProgress - num(cur.plannedQuantity));
    }
  }

  const draftRows = await prisma.productionOrder.findMany({
    where: {
      companyId,
      manufacturingWorkOrderId: workOrderId,
      bomId,
      status: 'DRAFT',
      ...(excludeOrderId ? { id: { not: excludeOrderId } } : {}),
    },
    select: { plannedQuantity: true },
  });
  const draftReserved = draftRows.reduce((s, o) => s + num(o.plannedQuantity), 0);

  const max = Math.max(
    0,
    row.requiredQuantity - row.completedQuantity - otherInProgress - draftReserved
  );
  if (plannedQuantity > max + 1e-6) {
    throw new AppError(
      422,
      `الكمية تتجاوز المتبقي من أمر الشغل لهذا النموذج (الحد الأقصى ${max})`
    );
  }
}

export async function markWorkOrderInProgressIfNeeded(companyId: string, workOrderId: string) {
  const wo = await prisma.manufacturingWorkOrder.findFirst({
    where: { id: workOrderId, companyId },
    select: { id: true, status: true },
  });
  if (!wo) return;
  if (wo.status === 'CANCELLED' || wo.status === 'COMPLETED' || wo.status === 'CLOSED') return;
  if (wo.status === 'IN_PROGRESS') return;
  await prisma.manufacturingWorkOrder.update({
    where: { id: workOrderId },
    data: { status: 'IN_PROGRESS' },
  });
}
