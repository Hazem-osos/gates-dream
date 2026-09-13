export interface ParsedClipboardRow {
  itemCode?: string;
  itemName?: string;
  quantity?: number;
  unitCost?: number;
  warehouseCode?: string;
  batchNumber?: string;
  expiryDate?: string;
}

export function parseExcelClipboard(clipboardText: string): string[][] {
  if (!clipboardText || !clipboardText.trim()) return [];

  return clipboardText
    .trim()
    .split(/\r\n|\n|\r/)
    .map((row) => row.split('\t').map((cell) => cell.trim()))
    .filter((row) => row.some((cell) => cell.length > 0));
}

function parseNumber(raw?: string): number | undefined {
  if (!raw) return undefined;
  const n = Number(String(raw).replace(/,/g, ''));
  return Number.isFinite(n) ? n : undefined;
}

export function parseOpeningStockClipboardRows(clipboardText: string): ParsedClipboardRow[] {
  return parseExcelClipboard(clipboardText).map((cols) => ({
    itemCode: cols[0] || undefined,
    itemName: cols[1] || undefined,
    quantity: parseNumber(cols[2] ?? cols[0]),
    unitCost: parseNumber(cols[3] ?? cols[1]),
    warehouseCode: cols[4] || undefined,
    batchNumber: cols[5] || undefined,
    expiryDate: cols[6] || undefined,
  }));
}

export const OPENING_STOCK_PASTE_FIELDS = [
  'itemCode',
  'itemName',
  'unitName',
  'warehouseId',
  'quantity',
  'unitCost',
  'batchNumber',
  'expiryDate',
] as const;

export type OpeningStockPasteField = (typeof OPENING_STOCK_PASTE_FIELDS)[number];

export function parseClipboardDate(raw?: string): string | undefined {
  if (!raw) return undefined;
  const value = raw.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const dmy = value.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})$/);
  if (dmy) {
    const day = dmy[1].padStart(2, '0');
    const month = dmy[2].padStart(2, '0');
    const year = dmy[3].length === 2 ? `20${dmy[3]}` : dmy[3];
    return `${year}-${month}-${day}`;
  }
  const parsed = Date.parse(value);
  if (!Number.isNaN(parsed)) return new Date(parsed).toISOString().slice(0, 10);
  return undefined;
}

export function mapClipboardFromField(
  clipboardText: string,
  startField: string
): Array<Partial<Record<OpeningStockPasteField, string>>> {
  const rows = parseExcelClipboard(clipboardText);
  const start = OPENING_STOCK_PASTE_FIELDS.indexOf(startField as OpeningStockPasteField);
  const offset = start === -1 ? 0 : start;

  return rows.map((cols) => {
    const mapped: Partial<Record<OpeningStockPasteField, string>> = {};
    cols.forEach((cell, i) => {
      const field = OPENING_STOCK_PASTE_FIELDS[offset + i];
      if (field) mapped[field] = cell;
    });
    return mapped;
  });
}
