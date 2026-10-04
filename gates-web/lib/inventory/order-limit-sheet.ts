export const ORDER_LIMIT_SHEET_HEADERS = [
  'كود الصنف',
  'اسم الصنف',
  'رصيد المخزن',
  'الحد الأدنى',
  'حد الطلب',
  'الحد الأعلى',
] as const;

const SHEET_FIELDS: Record<string, 'code' | 'name' | 'lower' | 'order' | 'upper'> = {
  'كود الصنف': 'code',
  'اسم الصنف': 'name',
  'الحد الأدنى': 'lower',
  'حد الطلب': 'order',
  'الحد الأعلى': 'upper',
};

export type OrderLimitSheetRow = {
  code: string;
  name: string;
  lower: string;
  order: string;
  upper: string;
};

export type OrderLimitSheetLine = {
  key: string;
  itemCode: string;
  itemName: string;
  lowerLimit: string;
  orderLimit: string;
  upperLimit: string;
};

function sheetCell(value: unknown): string {
  if (value == null) return '';
  return String(value).trim();
}

export function parseOrderLimitSheet(matrix: unknown[][]): OrderLimitSheetRow[] {
  if (matrix.length < 2) return [];
  const headers = (matrix[0] as unknown[]).map((cell) => sheetCell(cell));
  return matrix.slice(1).flatMap((raw) => {
    const values = raw as unknown[];
    const row: OrderLimitSheetRow = { code: '', name: '', lower: '', order: '', upper: '' };
    let touched = false;
    headers.forEach((header, index) => {
      const field = SHEET_FIELDS[header];
      if (!field) return;
      const text = sheetCell(values[index]);
      if (!text) return;
      row[field] = text;
      touched = true;
    });
    return touched ? [row] : [];
  });
}

export function applyOrderLimitSheet<T extends OrderLimitSheetLine>(
  lines: T[],
  rows: OrderLimitSheetRow[]
): { next: T[]; matched: number; missed: number } {
  const byCode = new Map<string, string[]>();
  const byName = new Map<string, string[]>();
  for (const line of lines) {
    const code = line.itemCode.trim().toLowerCase();
    const name = line.itemName.trim();
    if (code) byCode.set(code, [...(byCode.get(code) ?? []), line.key]);
    if (name) byName.set(name, [...(byName.get(name) ?? []), line.key]);
  }
  const updates = new Map<string, Partial<Pick<T, 'lowerLimit' | 'orderLimit' | 'upperLimit'>>>();
  let missed = 0;
  let matched = 0;
  for (const row of rows) {
    const hits =
      (row.code && byCode.get(row.code.trim().toLowerCase())) ||
      (row.name && byName.get(row.name.trim())) ||
      [];
    if (!hits.length) {
      missed += 1;
      continue;
    }
    matched += 1;
    for (const key of hits) {
      const prev = updates.get(key) ?? {};
      updates.set(key, {
        ...prev,
        ...(row.lower ? { lowerLimit: row.lower } : {}),
        ...(row.order ? { orderLimit: row.order } : {}),
        ...(row.upper ? { upperLimit: row.upper } : {}),
      });
    }
  }
  const next = lines.map((line) => {
    const patch = updates.get(line.key);
    return patch ? { ...line, ...patch } : line;
  });
  return { next, matched, missed };
}
