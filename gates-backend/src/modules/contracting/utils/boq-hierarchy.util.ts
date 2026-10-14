/**
 * Hierarchical work-item / owner-BOQ codes.
 *
 * Handwritten evidence uses dotted codes (`1`, `1.1`). Parent rows with children
 * are headers: they are not certified and are excluded from money/qty aggregates
 * so parent + child totals cannot be double-counted.
 *
 * A dash in an item code does not imply a parent/child relationship.
 *
 * `isExecutable` on a header is ignored for aggregation. A parent with children
 * is never a leaf.
 */

export type HierarchyNode = {
  id: string;
  parentId: string | null;
  itemCode: string;
  isExecutable?: boolean;
};

export function parentCodeFromItemCode(itemCode: string): string | null {
  const trimmed = String(itemCode ?? '').trim();
  const lastDot = trimmed.lastIndexOf('.');
  if (lastDot <= 0) return null;
  const parent = trimmed.slice(0, lastDot).trim();
  return parent.length ? parent : null;
}

/** Existing dotted children (`1.1`) of a newly created parent (`1`) that still lack parentId. */
export function orphanChildIdsForParentCode<T extends { id: string; itemCode: string; parentId: string | null }>(
  items: T[],
  parentCode: string,
  parentId: string
): string[] {
  const code = String(parentCode ?? '').trim();
  if (!code) return [];
  return items
    .filter(
      (row) => row.id !== parentId && !row.parentId && parentCodeFromItemCode(row.itemCode) === code
    )
    .map((row) => row.id);
}

/** Map child id → parent id from dotted codes (`1.1` → item `1`) on the same list. */
export function inferParentIdFromCodes<T extends { id: string; itemCode: string }>(
  items: T[]
): Map<string, string> {
  const byCode = new Map(items.map((row) => [row.itemCode.trim(), row.id]));
  const inferred = new Map<string, string>();
  for (const item of items) {
    const parentCode = parentCodeFromItemCode(item.itemCode);
    if (!parentCode) continue;
    const parentId = byCode.get(parentCode);
    if (parentId && parentId !== item.id) {
      inferred.set(item.id, parentId);
    }
  }
  return inferred;
}

export function childrenByParentId<T extends { id: string; parentId: string | null }>(
  items: T[]
): Map<string, T[]> {
  const map = new Map<string, T[]>();
  for (const item of items) {
    if (!item.parentId) continue;
    const bucket = map.get(item.parentId) ?? [];
    bucket.push(item);
    map.set(item.parentId, bucket);
  }
  return map;
}

export function hasChildren<T extends { id: string; parentId: string | null }>(
  items: T[],
  id: string
): boolean {
  return items.some((item) => item.parentId === id);
}

/**
 * Certification / rate-analysis header: FK children or `isExecutable === false`.
 * Item codes (including dashes) are not consulted.
 */
export function isNonCertifiableHeader<
  T extends { id: string; parentId: string | null; isExecutable?: boolean },
>(items: T[], id: string): boolean {
  const item = items.find((row) => row.id === id);
  if (!item) return false;
  return item.isExecutable === false || hasChildren(items, id);
}

/** Leaf = no children. Only leaves enter extract/invoice aggregates. */
export function isLeafItem<T extends { id: string; parentId: string | null }>(
  items: T[],
  id: string
): boolean {
  return !hasChildren(items, id);
}

export function leafItems<T extends { id: string; parentId: string | null }>(items: T[]): T[] {
  const childIds = childrenByParentId(items);
  return items.filter((item) => !childIds.has(item.id));
}

export function assertAcyclicParent(
  items: Array<{ id: string; parentId: string | null }>,
  childId: string,
  parentId: string | null
): void {
  if (!parentId) return;
  if (parentId === childId) {
    throw new Error('WORK_ITEM_PARENT_CYCLE');
  }
  const parentOf = new Map(items.map((row) => [row.id, row.parentId]));
  parentOf.set(childId, parentId);
  const seen = new Set<string>();
  let cursor: string | null = parentId;
  while (cursor) {
    if (seen.has(cursor)) {
      throw new Error('WORK_ITEM_PARENT_CYCLE');
    }
    seen.add(cursor);
    cursor = parentOf.get(cursor) ?? null;
  }
}

/**
 * Sum leaf `quantity * unitPrice` only. Header stored totals are ignored.
 * Rounding is applied by the caller (`roundTo4` / `money`).
 */
export function sumLeafLineAmounts<
  T extends { id: string; parentId: string | null; quantity: number; unitPrice: number | null },
>(items: T[], multiply: (qty: number, price: number) => number): number {
  let total = 0;
  for (const item of leafItems(items)) {
    const price = item.unitPrice ?? 0;
    total += multiply(item.quantity, price);
  }
  return total;
}

export function descendantIds<T extends { id: string; parentId: string | null }>(
  items: T[],
  rootId: string
): string[] {
  const byParent = childrenByParentId(items);
  const out: string[] = [];
  const stack = [...(byParent.get(rootId) ?? [])];
  while (stack.length) {
    const node = stack.pop()!;
    out.push(node.id);
    const kids = byParent.get(node.id);
    if (kids) stack.push(...kids);
  }
  return out;
}
