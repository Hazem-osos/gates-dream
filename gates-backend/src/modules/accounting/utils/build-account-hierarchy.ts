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
  accountKind: 'HEADER' | 'POSTING';
  accountType: string;
  isParent: boolean;
  level: number;
  currentBalance: number;
  parentId?: string | null;
  defaultCostCenterId?: string | null;
  costCenterRequired?: string | null;
  isActive?: boolean;
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
  accountKind?: 'HEADER' | 'POSTING' | null;
  isActive?: boolean;
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
    if (parentKey === account.id) parentKey = null;
    if (parentKey && !idSet.has(parentKey)) {
      parentKey = null;
    }
    const bucket = childrenByParent.get(parentKey) ?? [];
    bucket.push(account);
    childrenByParent.set(parentKey, bucket);
  }

  const sortByCode = (a: FlatAccountForHierarchy, b: FlatAccountForHierarchy) =>
    a.code.localeCompare(b.code, undefined, { numeric: true });

  const visited = new Set<string>();
  const buildNode = (row: FlatAccountForHierarchy, level: number): AccountHierarchyNode | null => {
    if (visited.has(row.id)) return null;
    visited.add(row.id);
    const childNodes = (childrenByParent.get(row.id) ?? [])
      .slice()
      .sort(sortByCode)
      .flatMap((child) => {
        const node = buildNode(child, level + 1);
        return node ? [node] : [];
      });
    const ownBalance = balanceByAccountId?.get(row.id) ?? 0;
    const childrenBalance = childNodes.reduce((s, c) => s + c.currentBalance, 0);
    const isHeader = row.accountKind === 'HEADER' || childNodes.length > 0;
    const node: AccountHierarchyNode = {
      id: row.id,
      code: row.code,
      nameAr: row.arabicName,
      nameEn: row.englishName,
      arabicName: row.arabicName,
      englishName: row.englishName,
      nature: natureFromAccount(row),
      type: isHeader ? 'HEADER' : 'DETAIL',
      accountKind: isHeader ? 'HEADER' : 'POSTING',
      accountType: row.accountType ?? '',
      isParent: isHeader,
      level,
      parentId: row.parentId === row.id ? null : row.parentId,
      currentBalance: childNodes.length > 0 ? childrenBalance : ownBalance,
      defaultCostCenterId: row.defaultCostCenterId ?? null,
      costCenterRequired: row.costCenterRequired ?? null,
      isActive: row.isActive !== false,
    };
    if (childNodes.length > 0) {
      node.children = childNodes;
    }
    return node;
  };

  const roots = (childrenByParent.get(null) ?? [])
    .slice()
    .sort(sortByCode)
    .flatMap((row) => {
      const node = buildNode(row, 1);
      return node ? [node] : [];
    });

  for (const account of accounts.slice().sort(sortByCode)) {
    if (visited.has(account.id)) continue;
    const node = buildNode(account, 1);
    if (node) roots.push(node);
  }

  return roots;
}

export function findHierarchySubtree(
  roots: AccountHierarchyNode[],
  parentId: string,
  seen = new Set<string>()
): AccountHierarchyNode[] | null {
  for (const node of roots) {
    if (seen.has(node.id)) continue;
    seen.add(node.id);
    if (node.id === parentId) {
      return node.children ?? [];
    }
    if (node.children?.length) {
      const hit = findHierarchySubtree(node.children, parentId, seen);
      if (hit) return hit;
    }
  }
  return null;
}
