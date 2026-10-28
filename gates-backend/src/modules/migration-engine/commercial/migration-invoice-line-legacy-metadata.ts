import { legacyTrim } from '../transforms/legacy-values';

const LINE_MAPPED = new Set([
  'CompanyCode',
  'BranchCode',
  'YearID',
  'InvoiceNum',
  'Type',
  'ItemCode',
  'UnitCode1',
  'UnitCode2',
  'Qty1',
  'Qty2',
  'Price',
  'TotalValue',
  'DiscPercent',
  'DiscValue',
  'DiscountValue',
  'DaribaPercent',
  'DaribaValue',
  'NetValue',
  'ExpDate',
  'ExpDateH',
  'StoreCode',
  'CCenter',
  'CostPrice',
  'SerialNums',
  'ItemDesc',
  'GridNum',
  'Serial',
  'LineNum',
  'ItemColorSizeCode',
  'QtyUsed1',
  'QtyUsed2',
  'QtyReturned1',
  'QtyReturned2',
  'ItemWeight',
  'Weight',
  'Width',
  'Length',
]);

export function buildInvoiceLineNotes(row: Record<string, unknown>): string | null {
  const legacyMigration: Record<string, string | number> = {};
  for (const [key, v] of Object.entries(row)) {
    if (LINE_MAPPED.has(key) || v == null || v === '') continue;
    if (typeof v === 'number') legacyMigration[key] = v;
    else if (v instanceof Date) legacyMigration[key] = v.toISOString();
    else legacyMigration[key] = legacyTrim(v);
  }
  const desc = legacyTrim(row.ItemDesc);
  if (!desc && !Object.keys(legacyMigration).length) return null;
  return JSON.stringify({
    description: desc || undefined,
    legacyMigration: Object.keys(legacyMigration).length ? legacyMigration : undefined,
  });
}

export function parseColorSize(code: unknown): { color: string | null; size: string | null } {
  const raw = legacyTrim(code);
  if (!raw) return { color: null, size: null };
  const parts = raw.split(/[-|/]/).map((p) => p.trim()).filter(Boolean);
  if (parts.length >= 2) return { color: parts[0], size: parts[1] };
  return { color: raw, size: null };
}
