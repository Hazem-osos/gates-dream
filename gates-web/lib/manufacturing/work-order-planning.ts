export type WorkOrderBomPlan = {
  bomId: string;
  modelCount: number;
  itemId?: string;
  notes?: string;
};

export type BomPickerRow = {
  id: string;
  name: string;
  finishedItemId?: string;
  finishedItem?: { id: string; arabicName: string };
};

export function resolveBomForFinishedItem(
  boms: BomPickerRow[],
  itemId: string
): BomPickerRow | undefined {
  if (!itemId) return undefined;
  return boms.find((b) => b.finishedItemId === itemId || b.finishedItem?.id === itemId);
}

export type WorkOrderPlanningMetadata = {
  bomPlans?: WorkOrderBomPlan[];
  planningWarehouseId?: string;
  salesOrderNumber?: string;
  salesOrderInvoiceId?: string;
  deliveryLeadDays?: number;
  expectedDeliveryDate?: string;
  fromWarehouseId?: string;
  toWarehouseId?: string;
  stage?: string;
  costCenter?: string;
};

export function parseWorkOrderPlanningMeta(
  processMetadata: Record<string, unknown> | null | undefined
): WorkOrderPlanningMetadata {
  if (!processMetadata || typeof processMetadata !== 'object') return {};
  const bomPlans = Array.isArray(processMetadata.bomPlans)
    ? processMetadata.bomPlans
        .map((row) => {
          const r = row as { bomId?: string; modelCount?: number; notes?: string; itemId?: string };
          const bomId = String(r.bomId ?? '').trim();
          const modelCount = Number(r.modelCount);
          const itemId = r.itemId?.trim() || undefined;
          if (!bomId || !Number.isFinite(modelCount) || modelCount <= 0) return null;
          return { bomId, modelCount, itemId, notes: r.notes?.trim() || undefined };
        })
        .filter(Boolean) as WorkOrderBomPlan[]
    : undefined;

  return {
    bomPlans,
    planningWarehouseId:
      typeof processMetadata.planningWarehouseId === 'string'
        ? processMetadata.planningWarehouseId
        : undefined,
    salesOrderNumber:
      typeof processMetadata.salesOrderNumber === 'string'
        ? processMetadata.salesOrderNumber
        : undefined,
    salesOrderInvoiceId:
      typeof processMetadata.salesOrderInvoiceId === 'string'
        ? processMetadata.salesOrderInvoiceId
        : undefined,
    deliveryLeadDays: Number.isFinite(Number(processMetadata.deliveryLeadDays))
      ? Number(processMetadata.deliveryLeadDays)
      : undefined,
    expectedDeliveryDate:
      typeof processMetadata.expectedDeliveryDate === 'string'
        ? processMetadata.expectedDeliveryDate
        : undefined,
    fromWarehouseId:
      typeof processMetadata.fromWarehouseId === 'string'
        ? processMetadata.fromWarehouseId
        : undefined,
    toWarehouseId:
      typeof processMetadata.toWarehouseId === 'string'
        ? processMetadata.toWarehouseId
        : undefined,
    stage: typeof processMetadata.stage === 'string' ? processMetadata.stage : undefined,
    costCenter:
      typeof processMetadata.costCenter === 'string' ? processMetadata.costCenter : undefined,
  };
}

export function getAllowedBomIds(
  processMetadata: Record<string, unknown> | null | undefined,
  legacyBomId?: string | null
): Set<string> {
  const meta = parseWorkOrderPlanningMeta(processMetadata);
  const set = new Set<string>();
  if (legacyBomId?.trim()) set.add(legacyBomId.trim());
  for (const p of meta.bomPlans ?? []) set.add(p.bomId);
  return set;
}

export function getBomPlan(
  processMetadata: Record<string, unknown> | null | undefined,
  bomId: string
): WorkOrderBomPlan | undefined {
  const meta = parseWorkOrderPlanningMeta(processMetadata);
  return meta.bomPlans?.find((p) => p.bomId === bomId);
}

export type ProductionPlanRow = {
  id: string;
  itemId: string;
  itemName: string;
  lineDescription: string;
  modelCount: string;
  bomId: string;
  bomName: string;
};

export function buildProductionPlanRows(
  workOrderLines: Array<{
    itemId: string;
    plannedQuantity: string | number;
    lineDescription?: string | null;
    item?: { arabicName: string };
  }>,
  boms: BomPickerRow[],
  meta: WorkOrderPlanningMetadata
): ProductionPlanRow[] {
  const planByItem = new Map(
    (meta.bomPlans ?? [])
      .filter((p) => p.itemId)
      .map((p) => [p.itemId!, p] as const)
  );
  const planByBom = new Map((meta.bomPlans ?? []).map((p) => [p.bomId, p] as const));

  return workOrderLines.map((line) => {
    const bom = resolveBomForFinishedItem(boms, line.itemId);
    const fromItem = planByItem.get(line.itemId);
    const fromBom = bom ? planByBom.get(bom.id) : undefined;
    const qty =
      fromItem?.modelCount ?? fromBom?.modelCount ?? (Number(line.plannedQuantity) || 1);
    const bomId = bom?.id ?? fromItem?.bomId ?? '';
    return {
      id: `pl-${line.itemId}`,
      itemId: line.itemId,
      itemName: line.item?.arabicName ?? line.itemId,
      lineDescription: line.lineDescription?.trim() ?? '',
      modelCount: String(qty),
      bomId,
      bomName: bom?.name ?? (bomId ? 'نموذج مرتبط' : 'لا يوجد نموذج لهذا الصنف'),
    };
  });
}

export function bomPlansFromProductionRows(rows: ProductionPlanRow[]): WorkOrderBomPlan[] {
  return rows
    .filter((r) => r.itemId && r.bomId && Number(r.modelCount) > 0)
    .map((r) => ({
      bomId: r.bomId,
      modelCount: Number(r.modelCount),
      itemId: r.itemId,
    }));
}

export function mergePlanningMeta(
  existing: Record<string, unknown> | null | undefined,
  patch: WorkOrderPlanningMetadata
): Record<string, unknown> {
  const base = { ...(existing ?? {}) } as Record<string, unknown>;
  if (patch.bomPlans) base.bomPlans = patch.bomPlans;
  if (patch.planningWarehouseId !== undefined) base.planningWarehouseId = patch.planningWarehouseId;
  return { ...base, ...patch };
}
