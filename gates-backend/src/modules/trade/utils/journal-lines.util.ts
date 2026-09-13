export function journalLines(
  rows: Array<{
    accountId: string;
    debit: number;
    credit: number;
    description?: string;
    costCenterId?: string;
  }>
) {
  const nonZero = rows.filter((row) => row.debit > 0 || row.credit > 0);
  return nonZero.map((row, idx) => ({
    ...row,
    lineOrder: idx + 1,
  }));
}
