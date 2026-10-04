/** Warehouse list limit wins when positive; zero in a list must not wipe the item-card limit. */
export function resolveEffectiveOrderLimit(
  warehouseListLimit: number | undefined,
  itemOrderLimit: number
): number {
  if (warehouseListLimit != null && warehouseListLimit > 0) return warehouseListLimit;
  return itemOrderLimit;
}

/** exceeded = at or below the reorder point. within = still above it. all = both. */
export function matchesOrderLimitStatus(
  orderLimit: number,
  currentQuantity: number,
  limitStatus: unknown
): boolean {
  if (!(orderLimit > 0)) return false;
  if (limitStatus === 'all') return true;
  if (limitStatus === 'within') return currentQuantity > orderLimit;
  return currentQuantity <= orderLimit;
}

export function orderLimitStatusLabel(
  orderLimit: number,
  currentQuantity: number,
  upperLimit: number
): string {
  if (upperLimit > 0 && currentQuantity > upperLimit) return 'فوق الحد الأعلى';
  if (orderLimit > 0 && currentQuantity <= orderLimit) return 'تحت حد الطلب';
  return 'لم يتعد حد الطلب';
}
