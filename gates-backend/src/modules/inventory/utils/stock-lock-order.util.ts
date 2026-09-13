/**
 * Wave 4 fix: `item_quantities` row locks (`stockMovementService`'s
 * `FOR UPDATE` in `lockItemQuantityInTx`) were always acquired in whatever
 * order a document's lines happened to be entered/stored in — i.e.
 * `lineOrder`. Two transactions posting documents whose lines reference the
 * same (warehouse, item, location) keys but in a different `lineOrder`
 * could each hold one lock and wait on the other, deadlocking. Sorting every
 * multi-line posting loop by this single canonical key before iterating
 * means every transaction in the system acquires stock locks in the same
 * global order, so that specific deadlock shape can no longer occur.
 */
export function stockLockSortKey(params: {
  warehouseId: string;
  itemId: string;
  locationId?: string | null;
}): string {
  return `${params.warehouseId}\u0000${params.itemId}\u0000${params.locationId ?? ''}`;
}

/** Returns a new array — never mutates the input — sorted by the canonical stock lock key. */
export function sortForStockLocking<T>(
  lines: T[],
  keyOf: (line: T) => { warehouseId: string; itemId: string; locationId?: string | null }
): T[] {
  return [...lines].sort((a, b) => {
    const ka = stockLockSortKey(keyOf(a));
    const kb = stockLockSortKey(keyOf(b));
    return ka < kb ? -1 : ka > kb ? 1 : 0;
  });
}
