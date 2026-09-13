import type { CoaHierarchyAccount } from '@/lib/accounting/mapCoaToTreeNodes';

export type FlatCoaRow = {
  node: CoaHierarchyAccount;
  depth: number;
  isLastSibling: boolean;
  rootDigit: string;
};

function rootDigitForNode(node: CoaHierarchyAccount, inherited: string): string {
  if (inherited) return inherited;
  return node.code.trim().charAt(0) || '0';
}

export function flattenVisibleCoaRows(
  nodes: CoaHierarchyAccount[],
  expandedIds: Set<string>,
  searchQuery: string
): FlatCoaRow[] {
  const forceOpen = Boolean(searchQuery.trim());
  const out: FlatCoaRow[] = [];

  function walk(
    list: CoaHierarchyAccount[],
    depth: number,
    inheritedRoot: string
  ) {
    list.forEach((node, idx) => {
      const branchRoot = rootDigitForNode(node, inheritedRoot);
      const hasChildren = Boolean(node.children?.length);
      const expanded = forceOpen || expandedIds.has(node.id);

      out.push({
        node,
        depth,
        isLastSibling: idx === list.length - 1,
        rootDigit: branchRoot,
      });

      if (hasChildren && expanded && node.children?.length) {
        walk(node.children, depth + 1, branchRoot);
      }
    });
  }

  walk(nodes, 0, '');
  return out;
}
