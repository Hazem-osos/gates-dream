export type StockTransferRow = Record<string, unknown>;

export type StockTransferGroup = {
  transferId: string;
  serial: string;
  lines: StockTransferRow[];
  total: number;
};

function money(value: unknown): number {
  const amount = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(amount) ? amount : 0;
}

export function roundMoney(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

/** Keeps document order and totals only the lines that belong to each transfer. */
export function groupStockTransferRows(rows: StockTransferRow[]): StockTransferGroup[] {
  const groups: StockTransferGroup[] = [];
  const index = new Map<string, StockTransferGroup>();
  rows.forEach((row, position) => {
    const transferId = typeof row.transferId === 'string' && row.transferId ? row.transferId : `row-${position}`;
    let group = index.get(transferId);
    if (!group) {
      group = {
        transferId,
        serial: typeof row.serial === 'string' ? row.serial.trim() : '',
        lines: [],
        total: 0,
      };
      index.set(transferId, group);
      groups.push(group);
    }
    group.lines.push(row);
    group.total = roundMoney(group.total + money(row.total));
  });
  const timeOf = (row: StockTransferRow) => {
    const value = row.date;
    if (value instanceof Date && !Number.isNaN(value.getTime())) return value.getTime();
    if (typeof value === 'string' && value.trim()) {
      const parsed = new Date(value);
      if (!Number.isNaN(parsed.getTime())) return parsed.getTime();
    }
    return Number.POSITIVE_INFINITY;
  };
  groups.sort((a, b) => {
    const byDate = timeOf(a.lines[0] ?? {}) - timeOf(b.lines[0] ?? {});
    if (byDate) return byDate;
    return a.serial.localeCompare(b.serial, 'ar');
  });
  for (const group of groups) {
    group.lines.sort((a, b) => timeOf(a) - timeOf(b));
  }
  return groups;
}
