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
  accountType?: string;
  currentBalance?: number;
  defaultCostCenterId?: string | null;
  costCenterRequired?: string | null;
  children?: CoaHierarchyAccount[];
};

function displayName(acc: CoaHierarchyAccount): string {
  return acc.nameAr ?? acc.arabicName;
}

export function mapCoaAccountsToTreeNodes(accounts: CoaHierarchyAccount[]): TreeNode[] {
  return accounts.map((acc) => {
    const childNodes = acc.children?.length ? mapCoaAccountsToTreeNodes(acc.children) : undefined;
    const isFolder = acc.isParent ?? Boolean(childNodes?.length);
    return {
      key: acc.id,
      label: `${acc.code} — ${displayName(acc)}`,
      data: isFolder ? 'folder' : 'file',
      expanded: isFolder,
      children: childNodes,
    };
  });
}

/** Leaf accounts under a folder node (direct children that are files). */
export function leafAccountsFromFolder(node: CoaHierarchyAccount): CoaHierarchyAccount[] {
  if (!node.children?.length) return [node];
  return node.children.flatMap((c) =>
    c.children?.length ? leafAccountsFromFolder(c) : [c]
  );
}
