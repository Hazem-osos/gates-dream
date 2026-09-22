import type { TreeNode } from 'primereact/treenode';

export type CoaHierarchyAccount = {
  id: string;
  code: string;
  arabicName: string;
  nameAr?: string;
  englishName?: string | null;
  nameEn?: string | null;
  isParent?: boolean;
  level?: number;
  nature?: 'DEBIT' | 'CREDIT';
  type?: 'HEADER' | 'DETAIL';
  accountKind?: 'HEADER' | 'POSTING';
  accountType?: string;
  currentBalance?: number;
  parentId?: string | null;
  defaultCostCenterId?: string | null;
  costCenterRequired?: string | null;
  isActive?: boolean;
  currencyCode?: string | null;
  children?: CoaHierarchyAccount[];
};

export type CoaTreeRole = 'ROOT' | 'SUBHEADER' | 'POSTING';

export function resolveCoaTreeRole(
  node: Pick<CoaHierarchyAccount, 'accountKind' | 'type' | 'isParent' | 'parentId' | 'children'>,
  depth = 0
): CoaTreeRole {
  const isHeader =
    node.accountKind === 'HEADER' ||
    node.type === 'HEADER' ||
    (node.accountKind !== 'POSTING' &&
      node.type !== 'DETAIL' &&
      (node.isParent === true || Boolean(node.children?.length)));
  if (!isHeader) return 'POSTING';
  if (depth <= 0) return 'ROOT';
  return 'SUBHEADER';
}

/** Default company cash box — posting leaf, never a parent. Cash folders stay branchable. */
export function isSystemCashPostingAccount(node: {
  code?: string | null;
  arabicName?: string | null;
  nameAr?: string | null;
  accountKind?: string | null;
  type?: string | null;
  isParent?: boolean;
  children?: unknown[] | null;
}): boolean {
  const isHeader =
    node.accountKind === 'HEADER' ||
    node.type === 'HEADER' ||
    node.isParent === true ||
    Boolean(node.children?.length);
  if (isHeader) return false;
  return String(node.code ?? '').trim() === '1111';
}

function displayName(acc: CoaHierarchyAccount): string {
  return acc.nameAr ?? acc.arabicName;
}

export function mapCoaAccountsToTreeNodes(
  accounts: CoaHierarchyAccount[],
  seen = new Set<string>()
): TreeNode[] {
  return accounts.flatMap((acc) => {
    if (seen.has(acc.id)) return [];
    seen.add(acc.id);
    const childNodes = acc.children?.length ? mapCoaAccountsToTreeNodes(acc.children, seen) : undefined;
    const isFolder =
      acc.accountKind === 'HEADER' || acc.isParent || acc.type === 'HEADER' || Boolean(childNodes?.length);
    return [
      {
        key: acc.id,
        label: `${acc.code} — ${displayName(acc)}`,
        data: isFolder ? 'folder' : 'file',
        expanded: isFolder,
        children: childNodes,
      },
    ];
  });
}

export function collectAncestorIds(
  roots: CoaHierarchyAccount[],
  accountId: string
): string[] {
  const walk = (
    nodes: CoaHierarchyAccount[],
    trail: string[],
    seen: Set<string>
  ): string[] | null => {
    for (const node of nodes) {
      if (seen.has(node.id)) continue;
      seen.add(node.id);
      if (node.id === accountId) return trail;
      if (node.children?.length) {
        const hit = walk(node.children, [...trail, node.id], seen);
        if (hit) return hit;
      }
    }
    return null;
  };
  return walk(roots, [], new Set()) ?? [];
}

export function collectIdsToDepth(
  nodes: CoaHierarchyAccount[],
  maxDepth: number,
  depth = 0,
  out: string[] = [],
  seen = new Set<string>()
): string[] {
  if (depth >= maxDepth) return out;
  for (const node of nodes) {
    if (seen.has(node.id)) continue;
    seen.add(node.id);
    if (node.children?.length) {
      out.push(node.id);
      collectIdsToDepth(node.children, maxDepth, depth + 1, out, seen);
    }
  }
  return out;
}

export function collectAccountAndDescendantIds(
  node: CoaHierarchyAccount | null | undefined,
  seen = new Set<string>()
): string[] {
  if (!node || seen.has(node.id)) return [];
  seen.add(node.id);
  const ids = [node.id];
  for (const child of node.children ?? []) {
    ids.push(...collectAccountAndDescendantIds(child, seen));
  }
  return ids;
}

/** Leaf accounts under a folder node (direct children that are files). */
export function leafAccountsFromFolder(
  node: CoaHierarchyAccount,
  seen = new Set<string>()
): CoaHierarchyAccount[] {
  if (seen.has(node.id)) return [];
  seen.add(node.id);
  const isHeader =
    node.accountKind === 'HEADER' || node.type === 'HEADER' || node.isParent || Boolean(node.children?.length);
  if (isHeader) {
    return (node.children ?? []).flatMap((child) => leafAccountsFromFolder(child, seen));
  }
  return [node];
}
