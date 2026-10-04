import { roundTo4 } from '../../../shared/utils/decimal-round';

export type MonthlySaleMovement = {
  itemId: string;
  itemName: string;
  itemSerial: string;
  /** 1–12 */
  month: number;
  quantity: number;
  amount: number;
  /** Sales and returns stay positive. Net is sales minus returns. */
  kind: 'sale' | 'return';
};

type MonthBucket = { saleQty: number; saleAmount: number; returnQty: number; returnAmount: number };

function emptyMonths(): MonthBucket[] {
  return Array.from({ length: 12 }, () => ({ saleQty: 0, saleAmount: 0, returnQty: 0, returnAmount: 0 }));
}

export function buildMonthlyItemSales(lines: MonthlySaleMovement[]): {
  rows: Array<Record<string, unknown>>;
  summary: {
    itemCount: number;
    saleQty: number;
    saleAmount: number;
    returnQty: number;
    returnAmount: number;
    netQty: number;
    netAmount: number;
  };
} {
  const items = new Map<string, { itemName: string; itemSerial: string; months: MonthBucket[] }>();

  for (const line of lines) {
    if (line.month < 1 || line.month > 12) continue;
    let bucket = items.get(line.itemId);
    if (!bucket) {
      bucket = { itemName: line.itemName, itemSerial: line.itemSerial, months: emptyMonths() };
      items.set(line.itemId, bucket);
    }
    const month = bucket.months[line.month - 1];
    const qty = Math.abs(line.quantity);
    const amount = Math.abs(line.amount);
    if (line.kind === 'return') {
      month.returnQty = roundTo4(month.returnQty + qty);
      month.returnAmount = roundTo4(month.returnAmount + amount);
    } else {
      month.saleQty = roundTo4(month.saleQty + qty);
      month.saleAmount = roundTo4(month.saleAmount + amount);
    }
  }

  const rows = [...items.entries()]
    .map(([itemId, bucket]) => shapeMonthlyItemRow(itemId, bucket))
    .filter(rowHasMovement)
    .sort(byItemName);

  return { rows, summary: summarizeMonthlyItemSales(rows) };
}

export type MonthlyCatalogItem = {
  itemId: string;
  itemName: string;
  itemSerial: string;
};

/** A listed catalog item with no sales and no returns in the period. */
export function emptyMonthlyItemRow(item: MonthlyCatalogItem): Record<string, unknown> {
  return shapeMonthlyItemRow(item.itemId, {
    itemName: item.itemName,
    itemSerial: item.itemSerial,
    months: emptyMonths(),
  });
}

function itemWasSold(row: Record<string, unknown>) {
  return Number(row.saleQty) !== 0 || Number(row.saleAmount) !== 0;
}

/**
 * When a group is selected, `catalog` adds its items that had no movement.
 * `hideUnsold` then drops every item that had no sales in the period.
 */
export function applyMonthlySalesVisibility(
  built: { rows: Array<Record<string, unknown>> },
  options: { hideUnsold: boolean; catalog?: MonthlyCatalogItem[] }
): { rows: Array<Record<string, unknown>>; summary: ReturnType<typeof summarizeMonthlyItemSales> } {
  let rows = built.rows;
  if (options.catalog?.length) {
    const seen = new Set(rows.map((row) => String(row.itemId)));
    const extras = options.catalog.filter((item) => !seen.has(item.itemId)).map(emptyMonthlyItemRow);
    rows = [...rows, ...extras].sort(byItemName);
  }
  if (options.hideUnsold) rows = rows.filter(itemWasSold);
  return { rows, summary: summarizeMonthlyItemSales(rows) };
}

function byItemName(a: Record<string, unknown>, b: Record<string, unknown>) {
  return String(a.itemName).localeCompare(String(b.itemName), 'ar');
}

function rowHasMovement(row: Record<string, unknown>) {
  return (
    Number(row.saleQty) !== 0 ||
    Number(row.saleAmount) !== 0 ||
    Number(row.returnQty) !== 0 ||
    Number(row.returnAmount) !== 0
  );
}

function shapeMonthlyItemRow(
  itemId: string,
  bucket: { itemName: string; itemSerial: string; months: MonthBucket[] }
): Record<string, unknown> {
  const shaped: Record<string, unknown> = {
    itemId,
    itemName: bucket.itemSerial ? `${bucket.itemSerial} — ${bucket.itemName}` : bucket.itemName,
  };
  let saleQty = 0;
  let saleAmount = 0;
  let returnQty = 0;
  let returnAmount = 0;
  for (let month = 1; month <= 12; month += 1) {
    const cell = bucket.months[month - 1];
    const netQty = roundTo4(cell.saleQty - cell.returnQty);
    const netAmount = roundTo4(cell.saleAmount - cell.returnAmount);
    shaped[`m${month}SaleQty`] = cell.saleQty;
    shaped[`m${month}SaleAmount`] = cell.saleAmount;
    shaped[`m${month}ReturnQty`] = cell.returnQty;
    shaped[`m${month}ReturnAmount`] = cell.returnAmount;
    shaped[`m${month}NetQty`] = netQty;
    shaped[`m${month}NetAmount`] = netAmount;
    saleQty = roundTo4(saleQty + cell.saleQty);
    saleAmount = roundTo4(saleAmount + cell.saleAmount);
    returnQty = roundTo4(returnQty + cell.returnQty);
    returnAmount = roundTo4(returnAmount + cell.returnAmount);
  }
  shaped.saleQty = saleQty;
  shaped.saleAmount = saleAmount;
  shaped.returnQty = returnQty;
  shaped.returnAmount = returnAmount;
  shaped.netQty = roundTo4(saleQty - returnQty);
  shaped.netAmount = roundTo4(saleAmount - returnAmount);
  return shaped;
}

function summarizeMonthlyItemSales(rows: Array<Record<string, unknown>>) {
  const summary = {
    itemCount: rows.length,
    saleQty: 0,
    saleAmount: 0,
    returnQty: 0,
    returnAmount: 0,
    netQty: 0,
    netAmount: 0,
  };
  for (const row of rows) {
    summary.saleQty = roundTo4(summary.saleQty + Number(row.saleQty));
    summary.saleAmount = roundTo4(summary.saleAmount + Number(row.saleAmount));
    summary.returnQty = roundTo4(summary.returnQty + Number(row.returnQty));
    summary.returnAmount = roundTo4(summary.returnAmount + Number(row.returnAmount));
  }
  summary.netQty = roundTo4(summary.saleQty - summary.returnQty);
  summary.netAmount = roundTo4(summary.saleAmount - summary.returnAmount);
  return summary;
}
