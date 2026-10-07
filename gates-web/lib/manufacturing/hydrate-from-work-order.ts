import { apiClient } from '@/lib/api/client';
import {
  buildLoadedProcessFromOrderMetadata,
  processHasLineContent,
  type BomForProcess,
  type LoadedManufacturingProcess,
} from '@/lib/manufacturing/process-from-bom';
import { getBomPlan, parseWorkOrderPlanningMeta } from '@/lib/manufacturing/work-order-planning';

export type WorkOrderForHydrate = {
  id: string;
  orderNumber: string;
  bomId: string | null;
  status?: string;
  salesOrderInvoiceId?: string | null;
  modelQuantity: string | number;
  description?: string | null;
  processMetadata?: Record<string, unknown> | null;
  lines?: Array<{
    itemId: string;
    plannedQuantity: string | number;
    completedQuantity?: string | number;
    item?: { arabicName?: string | null };
  }>;
  bom?: {
    finishedItem?: { arabicName?: string | null } | null;
  } | null;
};

/** الحد الأدنى لاستخراج أسماء المنتجات النهائية (قائمة أوامر الشغل، التفاصيل، إلخ). */
export type WorkOrderFinishedProductSource = {
  lines?: Array<{
    itemId: string;
    item?: { arabicName?: string | null };
  }>;
  bom?: {
    finishedItem?: { arabicName?: string | null } | null;
  } | null;
};

/** أسماء الأصناف النهائية في أمر الشغل (بنود الخطة / أمر البيع). */
export function describeWorkOrderFinishedProducts(
  workOrder: WorkOrderFinishedProductSource,
  resolveItemName?: (id: string) => string | undefined
): string {
  const names: string[] = [];
  for (const line of workOrder.lines ?? []) {
    const name =
      line.item?.arabicName?.trim() ||
      resolveItemName?.(line.itemId)?.trim() ||
      '';
    if (name && !names.includes(name)) names.push(name);
  }
  if (names.length > 0) return names.join(' · ');
  const fromBom = workOrder.bom?.finishedItem?.arabicName?.trim();
  return fromBom || '';
}

function num(v: string | number | null | undefined): number {
  return Number(v ?? 0);
}

/** كمية هذا أمر التصنيع (عدد النماذج) — وليس إجمالي خطة أمر الشغل. */
export function hydrateLoadedProcessFromWorkOrder(
  workOrder: WorkOrderForHydrate,
  bom: BomForProcess,
  manufacturingQty: number,
  resolveItemName?: (id: string) => string | undefined
): LoadedManufacturingProcess | null {
  const plan = getBomPlan(workOrder.processMetadata ?? null, bom.id);
  const fallbackQty = plan?.modelCount ?? num(workOrder.modelQuantity);
  const qty = manufacturingQty > 0 ? manufacturingQty : fallbackQty;
  if (!bom.id || qty <= 0) return null;

  const loaded = buildLoadedProcessFromOrderMetadata(null, bom, qty, resolveItemName);
  if (!loaded || !processHasLineContent(loaded)) return null;

  const wh = workOrderWarehousesFromMetadata(workOrder);
  if (!loaded.fromWarehouseId && wh.fromWarehouseId) loaded.fromWarehouseId = wh.fromWarehouseId;
  if (!loaded.toWarehouseId && wh.toWarehouseId) loaded.toWarehouseId = wh.toWarehouseId;
  if (!loaded.stage && wh.stage) loaded.stage = wh.stage;
  if (!loaded.costCenter && wh.costCenter) loaded.costCenter = wh.costCenter;

  loaded.outputs = loaded.outputs.map((o) => ({
    ...o,
    itemName: resolveItemName?.(o.itemId) ?? o.itemName,
  }));
  loaded.raws = loaded.raws.map((r) => ({
    ...r,
    itemName: resolveItemName?.(r.itemId) ?? r.itemName,
  }));

  return loaded;
}

export function workOrderWarehousesFromMetadata(
  workOrder: WorkOrderForHydrate
): { fromWarehouseId: string; toWarehouseId: string; stage: string; costCenter: string } {
  const meta = (workOrder.processMetadata ?? {}) as Record<string, unknown>;
  const from =
    (typeof meta.fromWarehouseId === 'string' && meta.fromWarehouseId) || '';
  const to = (typeof meta.toWarehouseId === 'string' && meta.toWarehouseId) || from;
  return {
    fromWarehouseId: from,
    toWarehouseId: to,
    stage: typeof meta.stage === 'string' ? meta.stage : '',
    costCenter: typeof meta.costCenter === 'string' ? meta.costCenter : '',
  };
}

export async function fetchWorkOrderAndBom(workOrderId: string, preferredBomId?: string) {
  const woRes = await apiClient.get<WorkOrderForHydrate>(`/manufacturing/work-orders/${workOrderId}`);
  const workOrder = woRes.data;
  const planning = parseWorkOrderPlanningMeta(workOrder.processMetadata ?? null);
  const bomId =
    preferredBomId?.trim() ||
    workOrder.bomId?.trim() ||
    planning.bomPlans?.[0]?.bomId ||
    '';
  if (!bomId) {
    throw new Error('لا يوجد نموذج مرتبط — افتح أمر الشغل واختر نماذج التصنيع ثم احفظ');
  }
  const bomRes = await apiClient.get<BomForProcess>(`/manufacturing/boms/${bomId}`);
  return { workOrder, bom: bomRes.data, bomId };
}
