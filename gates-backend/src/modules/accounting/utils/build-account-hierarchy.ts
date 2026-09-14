export type AccountHierarchyNode = {
  id: string;
  code: string;
  nameAr: string;
  nameEn?: string | null;
  /** @deprecated Prefer nameAr — kept for existing clients */
  arabicName: string;
  englishName?: string | null;
  nature: 'DEBIT' | 'CREDIT';
  type: 'HEADER' | 'DETAIL';
  accountType: string;
  isParent: boolean;
  level: number;
  currentBalance: number;
  defaultCostCenterId?: string | null;
  costCenterRequired?: string | null;
  children?: AccountHierarchyNode[];
};

export type FlatAccountForHierarchy = {
  id: string;
  code: string;
  arabicName: string;
  englishName: string | null;
  accountType: string | null;
  accountSide: string | null;
  parentId: string | null;
  defaultCostCenterId?: string | null;
  costCenterRequired?: string | null;
};

function natureFromAccount(account: FlatAccountForHierarchy): 'DEBIT' | 'CREDIT' {
  const side = account.accountSide?.toLowerCase();
  if (side === 'debit' || side === 'مدين') return 'DEBIT';
  if (side === 'credit' || side === 'دائن') return 'CREDIT';
  const type = account.accountType?.toLowerCase();
  if (type === 'asset' || type === 'expense') return 'DEBIT';
  return 'CREDIT';
}

export function buildAccountHierarchyTree(
  accounts: FlatAccountForHierarchy[],
  balanceByAccountId?: Map<string, number>
): AccountHierarchyNode[] {
  const idSet = new Set(accounts.map((a) => a.id));
  const childrenByParent = new Map<string | null, FlatAccountForHierarchy[]>();

  for (const account of accounts) {
    let parentKey: string | null = account.parentId;
    if (parentKey && !idSet.has(parentKey)) {
      parentKey = null;
    }
    const bucket = childrenByParent.get(parentKey) ?? [];
    bucket.push(account);
    childrenByParent.set(parentKey, bucket);
  }

  const sortByCode = (a: FlatAccountForHierarchy, b: FlatAccountForHierarchy) =>
    a.code.localeCompare(b.code, undefined, { numeric: true });

  const buildLevel = (parentId: string | null, level: number): AccountHierarchyNode[] => {
    const rows = (childrenByParent.get(parentId) ?? []).slice().sort(sortByCode);
    return rows.map((row) => {
      const childNodes = buildLevel(row.id, level + 1);
      const ownBalance = balanceByAccountId?.get(row.id) ?? 0;
      const childrenBalance = childNodes.reduce((s, c) => s + c.currentBalance, 0);
      const node: AccountHierarchyNode = {
        id: row.id,
        code: row.code,
        nameAr: row.arabicName,
        nameEn: row.englishName,
        arabicName: row.arabicName,
        englishName: row.englishName,
        nature: natureFromAccount(row),
        type: childNodes.length > 0 ? 'HEADER' : 'DETAIL',
        accountType: row.accountType ?? '',
        isParent: childNodes.length > 0,
        level,
        currentBalance:
          childNodes.length > 0 ? childrenBalance : ownBalance,
        defaultCostCenterId: row.defaultCostCenterId ?? null,
        costCenterRequired: row.costCenterRequired ?? null,
      };
      if (childNodes.length > 0) {
        node.children = childNodes;
      }
      return node;
    });
  };

  return buildLevel(null, 1);
}

export function findHierarchySubtree(
  roots: AccountHierarchyNode[],
  parentId: string
): AccountHierarchyNode[] | null {
  for (const node of roots) {
    if (node.id === parentId) {
      return node.children ?? [];
    }
    if (node.children?.length) {
      const hit = findHierarchySubtree(node.children, parentId);
      if (hit) return hit;
    }
  }
  return null;
}
