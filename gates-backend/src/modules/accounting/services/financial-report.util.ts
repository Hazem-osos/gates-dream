import { roundTo4, amountsEqualAt4 } from '../../../shared/utils/decimal-round';

export type AccountClass =
  | 'ASSET'
  | 'LIABILITY'
  | 'EQUITY'
  | 'REVENUE'
  | 'COGS'
  | 'EXPENSE'
  | 'OTHER';

function classifyByAccountType(accountType: string | null | undefined): AccountClass | null {
  const normalized = (accountType ?? '').trim().toLowerCase();
  if (!normalized) return null;
  if (normalized === 'cogs' || normalized === 'تكلفة المبيعات') return 'COGS';
  if (normalized === 'revenue' || normalized.includes('إيراد')) return 'REVENUE';
  if (normalized === 'expense' || normalized.includes('مصروف')) return 'EXPENSE';
  if (normalized === 'asset' || normalized.includes('أصل')) return 'ASSET';
  if (normalized === 'liability' || normalized.includes('التزام') || normalized.includes('خصوم')) {
    return 'LIABILITY';
  }
  if (normalized === 'equity' || normalized.includes('ملك')) return 'EQUITY';
  return null;
}

export function classifyAccount(code: string, accountType: string | null | undefined): AccountClass {
  const fromType = classifyByAccountType(accountType);
  if (fromType) return fromType;

  const c = code.trim();
  if (c.startsWith('51')) return 'COGS';
  if (c.startsWith('52') || c.startsWith('53')) return 'EXPENSE';
  if (c.startsWith('61') || c.startsWith('62')) return 'EXPENSE';
  if (c.startsWith('4')) return 'REVENUE';
  if (c.startsWith('1')) return 'ASSET';
  if (c.startsWith('2')) return 'LIABILITY';
  if (c.startsWith('3')) return 'EQUITY';
  return 'OTHER';
}

/** Sales and cost of sales. Administrative expenses stay on the income statement. */
export function isTradingStatementAccount(account: {
  code?: string | null;
  arabicName?: string | null;
  accountType?: string | null;
}): boolean {
  const name = (account.arabicName ?? '').replace(/\s+/g, ' ').trim();
  if (name === 'تكلفة النشاط والمبيعات') return true;
  const code = (account.code ?? '').trim();
  if (code.startsWith('51')) return true;
  const cls = classifyAccount(code, account.accountType);
  return cls === 'REVENUE' || cls === 'COGS';
}

/** Split signed net balance into trial-balance debit/credit columns. */
export function splitTrialBalanceColumns(netBalance: number): {
  endingDebit: number;
  endingCredit: number;
} {
  const net = roundTo4(netBalance);
  if (net >= 0) {
    return { endingDebit: net, endingCredit: 0 };
  }
  return { endingDebit: 0, endingCredit: roundTo4(-net) };
}

export function verifyTrialBalanceBalanced(
  rows: Array<{ endingDebit: number; endingCredit: number }>
): { balanced: boolean; totalEndingDebit: number; totalEndingCredit: number } {
  const totalEndingDebit = roundTo4(rows.reduce((s, r) => s + r.endingDebit, 0));
  const totalEndingCredit = roundTo4(rows.reduce((s, r) => s + r.endingCredit, 0));
  return {
    balanced: amountsEqualAt4(totalEndingDebit, totalEndingCredit),
    totalEndingDebit,
    totalEndingCredit,
  };
}

export function accountTreeLevel(code: string, maxLevel?: number): boolean {
  if (!maxLevel || maxLevel <= 0) return true;
  const segments = code.split(/[-.]/).filter(Boolean);
  if (segments.length > 1) return segments.length <= maxLevel;
  return code.length <= maxLevel * 2;
}

function childrenByParent(tree: Array<{ id: string; parentId: string | null }>): Map<string, string[]> {
  const map = new Map<string, string[]>();
  for (const account of tree) {
    if (!account.parentId) continue;
    const bucket = map.get(account.parentId) ?? [];
    bucket.push(account.id);
    map.set(account.parentId, bucket);
  }
  return map;
}

/** Selected account plus every account under it. `maxDepth` 1 keeps only the root. */
export function accountSubtreeIds(
  rootId: string,
  tree: Array<{ id: string; parentId: string | null }>,
  maxDepth?: number
): string[] {
  const children = childrenByParent(tree);
  const result = [rootId];
  const queue: Array<{ id: string; depth: number }> = [{ id: rootId, depth: 1 }];
  while (queue.length > 0) {
    const current = queue.shift()!;
    if (maxDepth != null && maxDepth > 0 && current.depth >= maxDepth) continue;
    for (const childId of children.get(current.id) ?? []) {
      result.push(childId);
      queue.push({ id: childId, depth: current.depth + 1 });
    }
  }
  return result;
}

function accountsAtRelativeLevel(
  rootId: string,
  tree: Array<{ id: string; parentId: string | null }>,
  level: number
): string[] {
  if (level <= 1) return [rootId];
  const children = childrenByParent(tree);
  let frontier = [rootId];
  for (let depth = 1; depth < level; depth += 1) {
    frontier = frontier.flatMap((id) => children.get(id) ?? []);
  }
  return frontier;
}

type TrialBalanceSourceRow = {
  accountId: string;
  code: string;
  openingNet: unknown;
  periodDebit: unknown;
  periodCredit: unknown;
};

/**
 * Trial balance account filter.
 * With an account, keep that account and its descendants (their own postings).
 * With an account and a level, show that depth and roll each row up from its subtree
 * so a group account still shows the balance posted on its children.
 * Without an account, the level stays a code-depth filter.
 */
function trialBalanceOwnMovement(row: TrialBalanceSourceRow): boolean {
  return Number(row.openingNet) !== 0 || Number(row.periodDebit) !== 0 || Number(row.periodCredit) !== 0;
}

/**
 * Preorder tree: each main account, then its children, then theirs.
 * A parent row shows the sum of its own movement and everything under it.
 */
export function arrangeTrialBalanceTree<T extends TrialBalanceSourceRow>(
  rows: T[],
  tree: Array<{ id: string; parentId: string | null; code?: string }>,
  options?: { maxDepth?: number }
): Array<T & { depth: number; isGroup: boolean; openingNet: number; periodDebit: number; periodCredit: number }> {
  const byId = new Map(rows.map((row) => [row.accountId, row]));
  const parentOf = new Map(tree.map((account) => [account.id, account.parentId]));
  const children = new Map<string, string[]>();
  for (const account of tree) {
    if (!account.parentId || !byId.has(account.id)) continue;
    const bucket = children.get(account.parentId) ?? [];
    bucket.push(account.id);
    children.set(account.parentId, bucket);
  }
  const codeOf = (id: string) => byId.get(id)?.code ?? tree.find((account) => account.id === id)?.code ?? id;
  for (const bucket of children.values()) {
    bucket.sort((a, b) => codeOf(a).localeCompare(codeOf(b), undefined, { numeric: true }));
  }

  const visible = new Set<string>();
  for (const row of rows) {
    if (!trialBalanceOwnMovement(row)) continue;
    visible.add(row.accountId);
    let parent = parentOf.get(row.accountId) ?? null;
    const seen = new Set<string>([row.accountId]);
    while (parent && byId.has(parent) && !seen.has(parent)) {
      seen.add(parent);
      visible.add(parent);
      parent = parentOf.get(parent) ?? null;
    }
  }

  const rolled = new Map<string, { openingNet: number; periodDebit: number; periodCredit: number }>();
  const rollup = (id: string): { openingNet: number; periodDebit: number; periodCredit: number } => {
    const cached = rolled.get(id);
    if (cached) return cached;
    const row = byId.get(id);
    const sum = {
      openingNet: Number(row?.openingNet ?? 0),
      periodDebit: Number(row?.periodDebit ?? 0),
      periodCredit: Number(row?.periodCredit ?? 0),
    };
    for (const childId of children.get(id) ?? []) {
      if (!byId.has(childId)) continue;
      const child = rollup(childId);
      sum.openingNet += child.openingNet;
      sum.periodDebit += child.periodDebit;
      sum.periodCredit += child.periodCredit;
    }
    rolled.set(id, sum);
    return sum;
  };

  const maxDepth = options?.maxDepth && options.maxDepth > 0 ? options.maxDepth : undefined;
  const walk = (id: string, depth: number): Array<T & { depth: number; isGroup: boolean; openingNet: number; periodDebit: number; periodCredit: number }> => {
    const head = byId.get(id);
    if (!head || !visible.has(id)) return [];
    const childIds = (children.get(id) ?? []).filter((childId) => visible.has(childId));
    const showChildren = maxDepth == null || depth + 1 < maxDepth;
    const sums = rollup(id);
    const node = {
      ...head,
      ...sums,
      depth,
      isGroup: childIds.length > 0,
    };
    if (!showChildren) return [node];
    return [node, ...childIds.flatMap((childId) => walk(childId, depth + 1))];
  };

  const roots = [...visible]
    .filter((id) => {
      const parent = parentOf.get(id);
      return !parent || !visible.has(parent);
    })
    .sort((a, b) => codeOf(a).localeCompare(codeOf(b), undefined, { numeric: true }));
  return roots.flatMap((id) => walk(id, 0));
}

export type LedgerMovementSlice = {
  accountId?: string;
  debitBase: number;
  creditBase: number;
};

/** Same account set as trial balance `maxDepth` under a selected root (rollup per row). */
export function accountIdsForStatementLevel(
  rootId: string,
  tree: Array<{ id: string; parentId: string | null; code?: string }>,
  openingByAccount: Map<string, number>,
  movements: LedgerMovementSlice[],
  maxLevel: number
): string[] {
  const subtreeIds = accountSubtreeIds(rootId, tree);
  const rows: TrialBalanceSourceRow[] = subtreeIds.map((accountId) => {
    const meta = tree.find((row) => row.id === accountId);
    let periodDebit = 0;
    let periodCredit = 0;
    for (const line of movements) {
      if (line.accountId !== accountId) continue;
      periodDebit = roundTo4(periodDebit + line.debitBase);
      periodCredit = roundTo4(periodCredit + line.creditBase);
    }
    return {
      accountId,
      code: meta?.code ?? '',
      openingNet: openingByAccount.get(accountId) ?? 0,
      periodDebit,
      periodCredit,
    };
  });
  const scoped = selectTrialBalanceRows(rows, { accountId: rootId, tree });
  return arrangeTrialBalanceTree(scoped, tree, { maxDepth: maxLevel }).map((row) => row.accountId);
}

export function selectTrialBalanceRows<T extends TrialBalanceSourceRow>(
  rows: T[],
  input: {
    level?: number;
    accountId?: string;
    tree?: Array<{ id: string; parentId: string | null }>;
  }
): T[] {
  if (!input.accountId || !input.tree?.length) {
    return rows.filter((row) => accountTreeLevel(row.code, input.level));
  }
  const include = new Set(accountSubtreeIds(input.accountId, input.tree));
  const inScope = rows.filter((row) => include.has(row.accountId));
  const level = input.level;
  if (!level || level <= 0) return inScope;

  const byId = new Map(inScope.map((row) => [row.accountId, row]));
  return accountsAtRelativeLevel(input.accountId, input.tree, level).flatMap((id) => {
    const head = byId.get(id);
    if (!head) return [];
    const members = accountSubtreeIds(id, input.tree!).filter((memberId) => include.has(memberId));
    let openingNet = 0;
    let periodDebit = 0;
    let periodCredit = 0;
    for (const memberId of members) {
      const row = byId.get(memberId);
      if (!row) continue;
      openingNet += Number(row.openingNet);
      periodDebit += Number(row.periodDebit);
      periodCredit += Number(row.periodCredit);
    }
    return [{ ...head, openingNet, periodDebit, periodCredit }];
  });
}

/** Opening plus the period lines, so the account footer debit minus credit equals its closing balance. */
export function ledgerSectionClose(
  lines: Array<{ debitBase: number; creditBase: number; runningBalance: number }>
): {
  opening: number;
  openingDebit: number;
  openingCredit: number;
  debit: number;
  credit: number;
  balance: number;
} {
  const first = lines[0];
  const opening = roundTo4(first.runningBalance - first.debitBase + first.creditBase);
  let debit = opening > 0 ? opening : 0;
  let credit = opening < 0 ? roundTo4(-opening) : 0;
  for (const line of lines) {
    debit = roundTo4(debit + line.debitBase);
    credit = roundTo4(credit + line.creditBase);
  }
  return {
    opening,
    openingDebit: opening > 0 ? opening : 0,
    openingCredit: opening < 0 ? roundTo4(-opening) : 0,
    debit,
    credit,
    balance: lines[lines.length - 1].runningBalance,
  };
}

export const ARABIC_MONTHS = [
  'يناير',
  'فبراير',
  'مارس',
  'أبريل',
  'مايو',
  'يونيو',
  'يوليو',
  'أغسطس',
  'سبتمبر',
  'أكتوبر',
  'نوفمبر',
  'ديسمبر',
] as const;

export type MonthlyClassRow = {
  year: number;
  month: number;
  class: AccountClass;
  amount: number;
  accountId: string;
  code: string;
  arabicName: string;
};

export type MonthPerformance = {
  year: number;
  month: number;
  label: string;
  revenue: number;
  cogs: number;
  expenses: number;
  grossProfit: number;
  netProfit: number;
  grossMargin: number | null;
  netMargin: number | null;
};

export type PerformanceDelta = { amount: number; percent: number | null };

function monthPerformance(rows: MonthlyClassRow[], year: number, month: number): MonthPerformance {
  const inMonth = rows.filter((row) => row.year === year && row.month === month);
  const sum = (cls: AccountClass) =>
    roundTo4(inMonth.filter((row) => row.class === cls).reduce((total, row) => total + row.amount, 0));
  const revenue = sum('REVENUE');
  const cogs = sum('COGS');
  const expenses = sum('EXPENSE');
  const grossProfit = roundTo4(revenue - cogs);
  const netProfit = roundTo4(grossProfit - expenses);
  const margin = (profit: number) => (revenue === 0 ? null : roundTo4((profit / revenue) * 100));
  return {
    year,
    month,
    label: ARABIC_MONTHS[month - 1] ?? String(month),
    revenue,
    cogs,
    expenses,
    grossProfit,
    netProfit,
    grossMargin: margin(grossProfit),
    netMargin: margin(netProfit),
  };
}

function performanceDelta(current: number, previous: number): PerformanceDelta {
  const amount = roundTo4(current - previous);
  return {
    amount,
    percent: previous === 0 ? null : roundTo4((amount / Math.abs(previous)) * 100),
  };
}

/** Twelve months of the selected year, the chosen month against the month before it and the same month last year. */
export function buildMonthlyPerformance(year: number, month: number, rows: MonthlyClassRow[]) {
  const current = monthPerformance(rows, year, month);
  const previous =
    month === 1 ? monthPerformance(rows, year - 1, 12) : monthPerformance(rows, year, month - 1);
  const lastYear = monthPerformance(rows, year - 1, month);
  const months = Array.from({ length: 12 }, (_, index) => monthPerformance(rows, year, index + 1));
  const expenseByAccount = new Map<string, { accountId: string; code: string; arabicName: string; amount: number }>();
  for (const row of rows) {
    if (row.year !== year || row.month !== month || row.class !== 'EXPENSE' || row.amount <= 0) continue;
    const existing = expenseByAccount.get(row.accountId);
    if (existing) existing.amount = roundTo4(existing.amount + row.amount);
    else expenseByAccount.set(row.accountId, {
      accountId: row.accountId,
      code: row.code,
      arabicName: row.arabicName,
      amount: row.amount,
    });
  }
  const topExpenses = [...expenseByAccount.values()].sort((a, b) => b.amount - a.amount).slice(0, 6);
  const versus = (other: MonthPerformance) => ({
    revenue: performanceDelta(current.revenue, other.revenue),
    grossProfit: performanceDelta(current.grossProfit, other.grossProfit),
    expenses: performanceDelta(current.expenses, other.expenses),
    netProfit: performanceDelta(current.netProfit, other.netProfit),
  });
  return { current, previousMonth: previous, sameMonthLastYear: lastYear, months, topExpenses, versusPrevious: versus(previous), versusLastYear: versus(lastYear) };
}

export type CenterMonthAmount = {
  year: number;
  month: number;
  costCenterId: string | null;
  class: 'REVENUE' | 'COGS' | 'EXPENSE';
  amount: number;
};

function centerPnl(rows: CenterMonthAmount[]) {
  const sum = (cls: CenterMonthAmount['class']) =>
    roundTo4(rows.filter((row) => row.class === cls).reduce((total, row) => total + row.amount, 0));
  const revenue = sum('REVENUE');
  const cogs = sum('COGS');
  const expenses = sum('EXPENSE');
  const netProfit = roundTo4(revenue - cogs - expenses);
  return { revenue, cogs, expenses, grossProfit: roundTo4(revenue - cogs), netProfit };
}

/** Ranks posting centers for one month and keeps a 12-month profit line for each. */
export function buildCostCenterProfitability(
  year: number,
  month: number,
  rows: CenterMonthAmount[],
  centers: Array<{ id: string; code: string; arabicName: string }>
) {
  const names = new Map(centers.map((center) => [center.id, center]));
  const ids = [...new Set(rows.map((row) => row.costCenterId).filter((id): id is string => Boolean(id)))];
  const ranked = ids
    .map((id) => {
      const info = names.get(id);
      const mine = (targetMonth: number) =>
        rows.filter((row) => row.costCenterId === id && row.year === year && row.month === targetMonth);
      const current = centerPnl(mine(month));
      const months = Array.from({ length: 12 }, (_, index) => ({
        month: index + 1,
        label: ARABIC_MONTHS[index],
        netProfit: centerPnl(mine(index + 1)).netProfit,
      }));
      return {
        id,
        code: info?.code ?? '',
        arabicName: info?.arabicName ?? id,
        ...current,
        months,
      };
    })
    .filter((center) => center.revenue !== 0 || center.cogs !== 0 || center.expenses !== 0 || center.months.some((item) => item.netProfit !== 0))
    .sort((a, b) => b.netProfit - a.netProfit || a.code.localeCompare(b.code));

  const companyNet = roundTo4(ranked.reduce((total, center) => total + center.netProfit, 0));
  const withShare = ranked.map((center) => ({
    ...center,
    share: companyNet === 0 ? null : roundTo4((center.netProfit / companyNet) * 100),
  }));
  return {
    monthLabel: ARABIC_MONTHS[month - 1] ?? String(month),
    companyNet,
    centers: withShare,
    unassigned: centerPnl(rows.filter((row) => row.costCenterId == null && row.year === year && row.month === month)),
  };
}

/** Keep budgeted accounts and every parent above them so the tree still prints. */
export function idsWithBudgetedLineage(
  tree: Array<{ id: string; parentId: string | null }>,
  budgetedIds: Iterable<string>
): Set<string> {
  const parentOf = new Map(tree.map((node) => [node.id, node.parentId]));
  const keep = new Set<string>();
  for (const id of budgetedIds) {
    keep.add(id);
    let parent = parentOf.get(id) ?? null;
    const seen = new Set<string>([id]);
    while (parent && !seen.has(parent)) {
      seen.add(parent);
      keep.add(parent);
      parent = parentOf.get(parent) ?? null;
    }
  }
  return keep;
}
