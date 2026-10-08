import { exportRowsToExcel } from '@/lib/export/export-utils';

export const STOCKTAKING_SHEET_HEADERS = [
  'كود الصنف',
  'اسم الصنف',
  'الكمية الدفترية',
  'الكمية الفعلية',
  'متوسط التكلفة',
] as const;

export type StocktakingExcelRow = {
  itemCode: string;
  itemName: string;
  bookQuantity: number;
  actualQuantity: number;
  averageUnitCost: number;
};

export async function exportStocktakingLinesToExcel(
  fileName: string,
  rows: StocktakingExcelRow[]
): Promise<void> {
  const matrix = rows.map((row) => [
    row.itemCode,
    row.itemName,
    row.bookQuantity,
    row.actualQuantity,
    row.averageUnitCost,
  ]);
  await exportRowsToExcel(
    fileName,
    [...STOCKTAKING_SHEET_HEADERS],
    matrix,
    'تسوية الجرد',
    [2, 3, 4]
  );
}

function cellText(value: unknown): string {
  return String(value ?? '').trim();
}

function num(value: unknown): number {
  const n = Number(String(value ?? '').replace(/,/g, ''));
  return Number.isFinite(n) ? n : 0;
}

export type ParsedStocktakingSheetRow = {
  itemCode: string;
  itemName: string;
  bookQuantity: number;
  actualQuantity: number;
};

/** Parse first sheet; matches by كود الصنف or اسم الصنف. */
export function parseStocktakingSheet(matrix: unknown[][]): ParsedStocktakingSheetRow[] {
  if (!matrix.length) return [];
  const header = matrix[0].map((c) => cellText(c));
  const codeIdx = header.findIndex((h) => /كود|code/i.test(h));
  const nameIdx = header.findIndex((h) => /اسم|name/i.test(h) && /صنف|item/i.test(h));
  const bookIdx = header.findIndex((h) => /دفتري|book|موجود/i.test(h));
  const actualIdx = header.findIndex((h) => /فعلي|actual|جرد/i.test(h));
  const out: ParsedStocktakingSheetRow[] = [];
  for (let ri = 1; ri < matrix.length; ri += 1) {
    const row = matrix[ri];
    if (!Array.isArray(row)) continue;
    const itemCode = codeIdx >= 0 ? cellText(row[codeIdx]) : '';
    const itemName = nameIdx >= 0 ? cellText(row[nameIdx]) : '';
    if (!itemCode && !itemName) continue;
    const bookQuantity = bookIdx >= 0 ? num(row[bookIdx]) : 0;
    const actualQuantity =
      actualIdx >= 0 ? num(row[actualIdx]) : bookIdx >= 0 ? num(row[bookIdx]) : 0;
    out.push({ itemCode, itemName, bookQuantity, actualQuantity });
  }
  return out;
}

export type StocktakingImportItem = {
  id: string;
  code: string;
  serial?: string | null;
  arabicName: string;
};

export type StocktakingLineDraft = {
  itemId: string;
  bookValue: number;
  actualValue: number;
  shortage: number;
  surplus: number;
  averageUnitCost: number;
  unitPrice: number;
};

export function applyStocktakingSheetToLines(
  parsed: ParsedStocktakingSheetRow[],
  items: StocktakingImportItem[],
  existing: StocktakingLineDraft[]
): { lines: StocktakingLineDraft[]; matched: number; missed: number } {
  const byCode = new Map<string, StocktakingImportItem>();
  const byName = new Map<string, StocktakingImportItem>();
  for (const item of items) {
    const code = cellText(item.code || item.serial);
    if (code) byCode.set(code.toLowerCase(), item);
    byName.set(cellText(item.arabicName).toLowerCase(), item);
  }
  const next: StocktakingLineDraft[] = [...existing];
  let matched = 0;
  let missed = 0;
  for (const row of parsed) {
    const item =
      (row.itemCode && byCode.get(row.itemCode.toLowerCase())) ||
      (row.itemName && byName.get(row.itemName.toLowerCase()));
    if (!item) {
      missed += 1;
      continue;
    }
    matched += 1;
    const bookValue = row.bookQuantity;
    const actualValue = row.actualQuantity;
    const delta = actualValue - bookValue;
    const idx = next.findIndex((l) => l.itemId === item.id);
    const averageUnitCost =
      idx >= 0 ? next[idx].averageUnitCost || next[idx].unitPrice : 0;
    const line = {
      itemId: item.id,
      bookValue,
      actualValue,
      shortage: delta < 0 ? -delta : 0,
      surplus: delta > 0 ? delta : 0,
      averageUnitCost,
      unitPrice: averageUnitCost,
    };
    if (idx >= 0) next[idx] = { ...next[idx], ...line };
    else next.push(line);
  }
  return { lines: next.filter((l) => l.itemId), matched, missed };
}
