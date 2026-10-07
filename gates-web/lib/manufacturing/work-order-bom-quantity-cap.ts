export type WorkOrderBomProgressRow = {
  bomId: string;
  bomName?: string;
  requiredQuantity: number;
  completedQuantity: number;
  inProgressQuantity: number;
  remainingQuantity: number;
  percentComplete?: number;
};

export type ProductionOrderQtyRef = {
  id?: string;
  bomId?: string;
  status?: string;
  plannedQuantity?: string | number;
  manufacturingWorkOrderId?: string | null;
};

function num(v: string | number | null | undefined): number {
  const n = Number(v ?? 0);
  return Number.isFinite(n) ? n : 0;
}

/** Reserved by other DRAFT production orders on the same work order + BOM. */
export function sumDraftPlannedForBom(
  orders: ProductionOrderQtyRef[],
  workOrderId: string,
  bomId: string,
  excludeOrderId?: string
): number {
  return orders
    .filter(
      (o) =>
        o.manufacturingWorkOrderId === workOrderId &&
        o.bomId === bomId &&
        o.status === 'DRAFT' &&
        (!excludeOrderId || o.id !== excludeOrderId)
    )
    .reduce((s, o) => s + num(o.plannedQuantity), 0);
}

/**
 * Max quantity user may plan on this production order for the BOM.
 * Matches work-order progress: required − completed − other in-progress − other drafts.
 */
export function computeMaxManufacturingQuantity(
  bomRow: WorkOrderBomProgressRow | undefined,
  options?: {
    currentOrder?: ProductionOrderQtyRef | null;
    draftReservedOther?: number;
  }
): number | null {
  if (!bomRow) return null;
  const { requiredQuantity, completedQuantity, inProgressQuantity } = bomRow;
  let otherInProgress = inProgressQuantity;
  const cur = options?.currentOrder;
  const curQty = num(cur?.plannedQuantity);
  if (
    cur?.id &&
    curQty > 0 &&
    (cur.status === 'RELEASED' || cur.status === 'IN_PROGRESS')
  ) {
    otherInProgress = Math.max(0, otherInProgress - curQty);
  }
  const draftOther = options?.draftReservedOther ?? 0;
  const max = requiredQuantity - completedQuantity - otherInProgress - draftOther;
  return Math.max(0, max);
}

export function formatWorkOrderQuantityCapMessage(
  bomRow: WorkOrderBomProgressRow,
  maxQuantity: number,
  enteredQuantity?: number
): string {
  const parts = [
    `المطلوب في أمر الشغل: ${bomRow.requiredQuantity.toLocaleString('ar-EG')}`,
    `منجز: ${bomRow.completedQuantity.toLocaleString('ar-EG')}`,
    `الحد الأقصى لهذا الأمر: ${maxQuantity.toLocaleString('ar-EG')}`,
  ];
  if (bomRow.inProgressQuantity > 0) {
    parts.push(`قيد التنفيذ (أوامر أخرى): ${bomRow.inProgressQuantity.toLocaleString('ar-EG')}`);
  }
  let msg = parts.join(' · ');
  if (enteredQuantity != null && Number.isFinite(enteredQuantity) && enteredQuantity > maxQuantity) {
    msg += ` — الكمية المدخلة (${enteredQuantity.toLocaleString('ar-EG')}) أكبر من الحد الأقصى`;
  }
  return msg;
}
