export const FIELD_ALIASES: Record<string, string[]> = {
  arabicName: ['اسم', 'اسم الصنف', 'name', 'الاسم', 'اسم العميل', 'customer', 'item'],
  mobile: ['موبايل', 'جوال', 'phone', 'mobile', 'تليفون'],
  code: ['كود الصنف', 'رقم الصنف', 'كود', 'code'],
  barcode: ['باركود', 'barcode'],
  price: ['سعر', 'price', 'السعر', 'سعر البيع', 'sales'],
  openingBalance: ['رصيد', 'balance', 'opening', 'رصيد افتتاحي', 'opening balance'],
  quantity: ['كمية', 'qty', 'quantity', 'رصيد مخزن'],
};

export function normalizeHeader(h: string): string {
  return h.trim().toLowerCase().replace(/\s+/g, ' ');
}

export function mapSpreadsheetRow(
  headers: string[],
  values: unknown[]
): Record<string, string | number | null> {
  const out: Record<string, string | number | null> = {};
  headers.forEach((h, i) => {
    const norm = normalizeHeader(h);
    let field: string | null = null;
    for (const [key, aliases] of Object.entries(FIELD_ALIASES)) {
      if (aliases.some((a) => norm.includes(a.toLowerCase()))) {
        field = key;
        break;
      }
    }
    if (!field && norm.includes('اسم')) field = 'arabicName';
    if (!field) return;
    const v = values[i];
    if (v == null || v === '') return;
    if (field === 'price' || field === 'openingBalance' || field === 'quantity') {
      const n = Number(v);
      out[field] = Number.isFinite(n) ? n : null;
    } else {
      out[field] = String(v);
    }
    if (field === 'code') out.serial = String(v);
    if (field === 'arabicName') out.arabicName = String(v);
  });
  return out;
}

export function parseSheetMatrix(rows: unknown[][]): Record<string, string | number | null>[] {
  if (rows.length < 2) return [];
  const headers = (rows[0] as unknown[]).map((c) => String(c ?? ''));
  return rows.slice(1).map((row) => mapSpreadsheetRow(headers, row as unknown[]));
}
