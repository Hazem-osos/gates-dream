/** Column ids that represent document / party code or serial in browse lists. */
const CODE_COLUMN_ID =
  /^(code|serial|num|number|voucherNumber|planNumber|orderNumber|invoiceNumber|itemCode)$/i;

const CODE_HEADER =
  /(الكود|كود|المسلسل|مسلسل|رقم|الرقم)/;

export function pickBrowseCodeColumnId(
  columnIds: string[],
  headers?: string[]
): string {
  const byId = columnIds.find((id) => CODE_COLUMN_ID.test(id));
  if (byId) return byId;
  if (headers?.length) {
    const idx = headers.findIndex((h) => CODE_HEADER.test(h));
    if (idx >= 0 && columnIds[idx]) return columnIds[idx];
  }
  return columnIds[0] ?? 'num';
}

export function mapBrowseColumnToApiSort(columnId: string): 'number' | 'date' | 'amount' {
  if (/date|createdAt/i.test(columnId)) return 'date';
  if (/amount|total|net/i.test(columnId)) return 'amount';
  return 'number';
}

export function compareBrowseText(a: string, b: string): number {
  return a.localeCompare(b, 'ar', { numeric: true, sensitivity: 'base' });
}
