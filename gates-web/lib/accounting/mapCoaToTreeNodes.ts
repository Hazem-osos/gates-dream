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
  children?: CoaHierarchyAccount[];
};

/** Default company cash box — posting leaf, never a parent. */
export function isSystemCashPostingAccount(node: {
  code?: string | null;
  arabicName?: string | null;
  nameAr?: string | null;
  children?: unknown[] | null;
}): boolean {
  const code = String(node.code ?? '').trim();
  if (code === '1111') return true;
  const name = `${node.arabicName ?? ''} ${node.nameAr ?? ''}`;
  return name.includes('الخزينة الرئيسية') && !node.children?.length;
}

function displayName(acc: CoaHierarchyAccount): string {
  return acc.nameAr ?? acc.arabicName;
}

export function mapCoaAccountsToTreeNodes(accounts: CoaHierarchyAccount[]): TreeNode[] {
  return accounts.map((acc) => {
    const childNodes = acc.children?.length ? mapCoaAccountsToTreeNodes(acc.children) : undefined;
    const isFolder =
      acc.accountKind === 'HEADER' || acc.isParent || acc.type === 'HEADER' || Boolean(childNodes?.length);
    return {
      key: acc.id,
      label: `${acc.code} — ${displayName(acc)}`,
      data: isFolder ? 'folder' : 'file',
      expanded: isFolder,
      children: childNodes,
    };
  });
}

export function collectAncestorIds(
  roots: CoaHierarchyAccount[],
  accountId: string
): string[] {
  const walk = (
    nodes: CoaHierarchyAccount[],
    trail: string[]
  ): string[] | null => {
    for (const node of nodes) {
      if (node.id === accountId) return trail;
      if (node.children?.length) {
        const hit = walk(node.children, [...trail, node.id]);
        if (hit) return hit;
      }
    }
    return null;
  };
  return walk(roots, []) ?? [];
}

export function collectIdsToDepth(
  nodes: CoaHierarchyAccount[],
  maxDepth: number,
  depth = 0,
  out: string[] = []
): string[] {
  if (depth >= maxDepth) return out;
  for (const node of nodes) {
    if (node.children?.length) {
      out.push(node.id);
      collectIdsToDepth(node.children, maxDepth, depth + 1, out);
    }
  }
  return out;
}

export function collectAccountAndDescendantIds(node: CoaHierarchyAccount | null | undefined): string[] {
  if (!node) return [];
  const ids = [node.id];
  for (const child of node.children ?? []) {
    ids.push(...collectAccountAndDescendantIds(child));
  }
  return ids;
}

/** Leaf accounts under a folder node (direct children that are files). */
export function leafAccountsFromFolder(node: CoaHierarchyAccount): CoaHierarchyAccount[] {
  const isHeader =
    node.accountKind === 'HEADER' || node.type === 'HEADER' || node.isParent || Boolean(node.children?.length);
  if (isHeader) {
    return (node.children ?? []).flatMap((child) => leafAccountsFromFolder(child));
  }
  return [node];
}
