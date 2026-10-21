/**
 * Display hierarchy for BOQ / work-item tables.
 * Prefer API `parentId` / `isLeaf` / `hasChildren` / `isExecutable` when present.
 * Code-based fallback is dot-only (`1` → `1.1`) when that parent exists on the
 * same list. A dash in an item code does not imply a parent/child relationship.
 */

export function splitItemCode(code: string): string[] {
  return String(code ?? '')
    .trim()
    .split(/[.\-\/]/)
    .map((part) => part.trim())
    .filter(Boolean);
}

/** Display indent depth is dot-only (`1.1` → 1). Hyphens are not hierarchy. */
export function itemCodeDepth(code: string): number {
  const trimmed = String(code ?? '').trim();
  if (!trimmed) return 0;
  return (trimmed.match(/\./g) ?? []).length;
}

export function compareItemCodes(a: string, b: string): number {
  const pa = splitItemCode(a);
  const pb = splitItemCode(b);
  const n = Math.max(pa.length, pb.length);
  for (let i = 0; i < n; i++) {
    const xa = pa[i] ?? '';
    const xb = pb[i] ?? '';
    const na = Number(xa);
    const nb = Number(xb);
    if (Number.isFinite(na) && Number.isFinite(nb) && xa !== '' && xb !== '' && na !== nb) {
      return na - nb;
    }
    const cmp = xa.localeCompare(xb, 'ar', { numeric: true, sensitivity: 'base' });
    if (cmp !== 0) return cmp;
  }
  return 0;
}

export function isParentItemCode(code: string, allCodes: readonly string[]): boolean {
  const trimmed = String(code ?? '').trim();
  if (!trimmed) return false;
  return allCodes.some((other) => {
    const next = String(other ?? '').trim();
    if (!next || next === trimmed) return false;
    return next.startsWith(`${trimmed}.`);
  });
}

export function sortByItemCode<T>(items: readonly T[], getCode: (row: T) => string): T[] {
  return [...items].sort((a, b) => compareItemCodes(getCode(a), getCode(b)));
}

export type HierarchicalWorkRow<T> = T & {
  __depth: number;
  __isParent: boolean;
  __isExecutable: boolean;
};

export type HierarchyHints<T> = {
  id?: (row: T) => string;
  parentId?: (row: T) => string | null | undefined;
  isLeaf?: (row: T) => boolean | undefined;
  isExecutable?: (row: T) => boolean | undefined;
  hasChildren?: (row: T) => boolean | undefined;
};

export function withItemCodeHierarchy<T>(
  items: readonly T[],
  getCode: (row: T) => string,
  hints?: HierarchyHints<T>
): HierarchicalWorkRow<T>[] {
  const sorted = sortByItemCode(items, getCode);
  const codes = sorted.map(getCode);
  const childOf = new Set(
    hints?.parentId
      ? sorted.map((row) => hints.parentId!(row)).filter((id): id is string => Boolean(id))
      : []
  );
  const byId = hints?.id
    ? new Map(sorted.map((row) => [hints.id!(row), row] as const))
    : null;

  return sorted.map((row) => {
    const code = getCode(row);
    const dottedParent = isParentItemCode(code, codes);
    const id = hints?.id?.(row);
    const apiHasChildren = hints?.hasChildren?.(row);
    const apiLeaf = hints?.isLeaf?.(row);
    const apiExecutable = hints?.isExecutable?.(row);
    const parentByFk = Boolean(id && childOf.has(id));
    const isParent =
      apiHasChildren === true ||
      apiLeaf === false ||
      apiExecutable === false ||
      parentByFk ||
      dottedParent;

    let depth = itemCodeDepth(code);
    if (hints?.parentId && hints?.id && byId) {
      let chain = 0;
      let parentId = hints.parentId(row);
      while (parentId && byId.has(parentId)) {
        chain += 1;
        parentId = hints.parentId(byId.get(parentId)!) ?? null;
      }
      depth = Math.max(depth, chain);
    }

    return {
      ...row,
      __depth: depth,
      __isParent: isParent,
      __isExecutable: !isParent,
    };
  });
}

export const ownerBoqHierarchyHints: HierarchyHints<{
  id: string;
  parentId?: string | null;
  isLeaf?: boolean;
  isExecutable?: boolean;
  hasChildren?: boolean;
}> = {
  id: (row) => row.id,
  parentId: (row) => row.parentId,
  isLeaf: (row) => row.isLeaf,
  isExecutable: (row) => row.isExecutable,
  hasChildren: (row) => row.hasChildren,
};

export const workItemHierarchyHints: HierarchyHints<{
  id: string;
  parentId?: string | null;
  isExecutable?: boolean;
  _count?: { children?: number };
}> = {
  id: (row) => row.id,
  parentId: (row) => row.parentId,
  isExecutable: (row) => row.isExecutable,
  hasChildren: (row) => (row._count?.children != null ? row._count.children > 0 : undefined),
};

/** رئيسي (جذر) vs رئيسي فرعي (مجموعة تحت الجذر). التنفيذي = null. */
export function boqHeaderRoleLabel(isParent: boolean, depth: number): string | null {
  if (!isParent) return null;
  return depth <= 0 ? 'رئيسي' : 'رئيسي فرعي';
}

/** الكمية تُدخل على البنود التنفيذية فقط (أبناء الرؤوس، وليس الرؤوس). */
export function canEnterBoqLineQuantity(isParent: boolean): boolean {
  return !isParent;
}

/** A nested dotted code is visible only when every ancestor code is expanded. Roots are always visible. */
export function isHierarchicalRowVisible(
  code: string,
  expandedCodes: ReadonlySet<string>
): boolean {
  const trimmed = String(code ?? '').trim();
  if (!trimmed.includes('.')) return true;
  const parts = trimmed.split('.');
  for (let i = 1; i < parts.length; i++) {
    if (!expandedCodes.has(parts.slice(0, i).join('.'))) return false;
  }
  return true;
}

/** parentId tree: row visible when every ancestor id is expanded. Roots always visible. */
export function isParentIdTreeRowVisible(
  row: { id: string; parentId?: string | null },
  expandedParentIds: ReadonlySet<string>,
  byId: ReadonlyMap<string, { id: string; parentId?: string | null }>
): boolean {
  let parentId = row.parentId ?? null;
  while (parentId) {
    if (!expandedParentIds.has(parentId)) return false;
    parentId = byId.get(parentId)?.parentId ?? null;
  }
  return true;
}

export function parentIdsWithChildren<T extends { id: string; parentId?: string | null }>(
  rows: readonly T[]
): Set<string> {
  const parents = new Set<string>();
  for (const row of rows) {
    if (row.parentId) parents.add(row.parentId);
  }
  return parents;
}

export function parentCodeFromItemCode(itemCode: string): string | null {
  const trimmed = String(itemCode ?? '').trim();
  const lastDot = trimmed.lastIndexOf('.');
  if (lastDot <= 0) return null;
  const parent = trimmed.slice(0, lastDot).trim();
  return parent.length ? parent : null;
}

export function executableRows<T>(rows: readonly HierarchicalWorkRow<T>[]): HierarchicalWorkRow<T>[] {
  return rows.filter((row) => row.__isExecutable);
}

/** Sum numeric values for executable (leaf) rows only — avoids parent/child double counting. */
export function sumExecutable<T>(
  rows: readonly HierarchicalWorkRow<T>[],
  value: (row: HierarchicalWorkRow<T>) => number
): number {
  return rows.reduce((sum, row) => (row.__isExecutable ? sum + value(row) : sum), 0);
}
