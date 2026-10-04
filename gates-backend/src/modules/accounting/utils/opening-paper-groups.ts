export type OpeningPaperDirection = 'RECEIPT' | 'PAYMENT';

export type OpeningPaperGroup = {
  accountId: string;
  direction: OpeningPaperDirection;
  amount: number;
  count: number;
};

function money(value: number): number {
  return Math.round((Number(value) || 0) * 100) / 100;
}

export function groupOpeningPapers(
  rows: Array<{ accountId: string | null; direction: OpeningPaperDirection; amount: number }>,
  fallback: { receiptAccountId: string | null; paymentAccountId: string | null }
): { groups: OpeningPaperGroup[]; missingAccount: boolean } {
  const map = new Map<string, OpeningPaperGroup>();
  let missingAccount = false;
  for (const row of rows) {
    const accountId =
      row.accountId ||
      (row.direction === 'PAYMENT' ? fallback.paymentAccountId : fallback.receiptAccountId);
    if (!accountId) {
      missingAccount = true;
      continue;
    }
    const key = `${row.direction}:${accountId}`;
    const current = map.get(key) ?? { accountId, direction: row.direction, amount: 0, count: 0 };
    current.amount = money(current.amount + (Number(row.amount) || 0));
    current.count += 1;
    map.set(key, current);
  }
  return { groups: [...map.values()], missingAccount };
}
