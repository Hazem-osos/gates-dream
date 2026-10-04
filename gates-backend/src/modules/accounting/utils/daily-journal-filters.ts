export type DailyJournalAmountOp = 'eq' | 'gt' | 'gte' | 'lt' | 'lte' | 'between';

export type DailyJournalAccountView = 'both' | 'main' | 'ledger';

export function parseDailyJournalAmountOp(value: unknown): DailyJournalAmountOp | undefined {
  const op = String(value ?? '').trim();
  if (op === 'eq' || op === 'gt' || op === 'gte' || op === 'lt' || op === 'lte' || op === 'between') {
    return op;
  }
  return undefined;
}

export function parseDailyJournalAccountView(value: unknown): DailyJournalAccountView {
  const view = String(value ?? '').trim();
  if (view === 'main' || view === 'ledger') return view;
  return 'both';
}

export function parseOptionalNumber(value: unknown): number | undefined {
  if (value == null || value === '') return undefined;
  const n = Number(String(value).replace(/,/g, '').trim());
  return Number.isFinite(n) ? n : undefined;
}

export function amountMatches(
  total: number,
  op: DailyJournalAmountOp,
  amount: number,
  amountTo?: number
): boolean {
  switch (op) {
    case 'eq':
      return Math.abs(total - amount) < 0.0001;
    case 'gt':
      return total > amount;
    case 'gte':
      return total >= amount;
    case 'lt':
      return total < amount;
    case 'lte':
      return total <= amount;
    case 'between': {
      const end = amountTo ?? amount;
      const low = Math.min(amount, end);
      const high = Math.max(amount, end);
      return total >= low && total <= high;
    }
    default:
      return true;
  }
}

export function voucherNumberInRange(
  voucherNumber: string | null | undefined,
  from?: number,
  to?: number
): boolean {
  if (from == null && to == null) return true;
  const raw = String(voucherNumber ?? '').trim();
  if (!raw) return false;
  const n = Number(raw);
  if (!Number.isFinite(n)) return false;
  if (from != null && n < from) return false;
  if (to != null && n > to) return false;
  return true;
}

export function collectSubtreeIds(
  rootId: string,
  accounts: Array<{ id: string; parentId: string | null }>
): string[] {
  const childrenByParent = new Map<string, string[]>();
  for (const account of accounts) {
    if (!account.parentId) continue;
    const bucket = childrenByParent.get(account.parentId) ?? [];
    bucket.push(account.id);
    childrenByParent.set(account.parentId, bucket);
  }
  const ids: string[] = [];
  const seen = new Set<string>();
  const queue = [rootId];
  while (queue.length) {
    const id = queue.shift()!;
    if (seen.has(id)) continue;
    seen.add(id);
    ids.push(id);
    for (const childId of childrenByParent.get(id) ?? []) queue.push(childId);
  }
  return ids;
}

export function accountDisplayLabel(code?: string | null, name?: string | null): string {
  const accountCode = (code ?? '').trim();
  const accountName = (name ?? '').trim();
  if (accountCode && accountName) return `${accountCode} — ${accountName}`;
  return accountName || accountCode;
}
