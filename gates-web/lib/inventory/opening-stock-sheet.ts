export const OPENING_STOCK_SHEET_HEADERS = [
  'كود الصنف',
  'اسم الصنف',
  'الوحدة',
  'المخزن',
  'كمية أول المدة',
  'تكلفة الوحدة',
  'رقم التشغيلة',
  'تاريخ الصلاحية',
] as const;

const SHEET_FIELDS: Record<string, keyof OpeningStockSheetRow> = {
  'كود الصنف': 'code',
  'اسم الصنف': 'name',
  الوحدة: 'unit',
  المخزن: 'warehouse',
  'كمية أول المدة': 'quantity',
  الكمية: 'quantity',
  'تكلفة الوحدة': 'unitCost',
  'رقم التشغيلة': 'batch',
  'تاريخ الصلاحية': 'expiry',
};

export type OpeningStockSheetRow = {
  code: string;
  name: string;
  unit: string;
  warehouse: string;
  quantity: string;
  unitCost: string;
  batch: string;
  expiry: string;
};

export type OpeningStockImportLine = {
  itemId: string;
  itemCode: string;
  itemName: string;
  unitName: string;
  warehouseId: string;
  quantity: number;
  unitCost: number;
  batchNumber: string;
  expiryDate: string;
};

function isoDate(year: number, month: number, day: number) {
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function excelSerialToIso(serial: number) {
  const utc = new Date(Date.UTC(1899, 11, 30) + Math.round(serial) * 86400000);
  return isoDate(utc.getUTCFullYear(), utc.getUTCMonth() + 1, utc.getUTCDate());
}

function sheetCell(value: unknown, asDate = false): string {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return isoDate(value.getFullYear(), value.getMonth() + 1, value.getDate());
  }
  if (asDate && typeof value === 'number' && value > 20000 && value < 80000) {
    return excelSerialToIso(value);
  }
  if (value == null) return '';
  return String(value).trim();
}

function blankRow(): OpeningStockSheetRow {
  return { code: '', name: '', unit: '', warehouse: '', quantity: '', unitCost: '', batch: '', expiry: '' };
}

export function parseOpeningStockSheet(matrix: unknown[][]): OpeningStockSheetRow[] {
  if (matrix.length < 2) return [];
  const headers = (matrix[0] as unknown[]).map((cell) => sheetCell(cell));
  return matrix.slice(1).flatMap((raw) => {
    const values = raw as unknown[];
    const row = blankRow();
    let touched = false;
    headers.forEach((header, index) => {
      const field = SHEET_FIELDS[header];
      if (!field) return;
      const text = sheetCell(values[index], field === 'expiry');
      if (!text) return;
      row[field] = text;
      touched = true;
    });
    if (!touched || (!row.code && !row.name)) return [];
    return [row];
  });
}

function parseAmount(text: string): number | null {
  if (!text.trim()) return null;
  const n = Number(text.replace(/,/g, ''));
  return Number.isFinite(n) ? n : null;
}

export function applyOpeningStockSheet(input: {
  lines: OpeningStockImportLine[];
  rows: OpeningStockSheetRow[];
  items: Array<{ id: string; code?: string | null; serial?: string | null; name: string; unitName: string; averageCost: number }>;
  warehouses: Array<{ id: string; code?: string | null; name: string }>;
  defaultWarehouseId: string;
}): { next: OpeningStockImportLine[]; matched: number; missed: number } {
  const byCode = new Map<string, (typeof input.items)[number]>();
  const byName = new Map<string, (typeof input.items)[number]>();
  for (const item of input.items) {
    const code = (item.code || '').trim().toLowerCase();
    const serial = (item.serial || '').trim().toLowerCase();
    const name = item.name.trim().toLowerCase();
    if (code) byCode.set(code, item);
    if (serial) byCode.set(serial, item);
    if (name) byName.set(name, item);
  }
  for (const line of input.lines) {
    if (!line.itemId) continue;
    const code = line.itemCode.trim().toLowerCase();
    const name = line.itemName.trim().toLowerCase();
    const known = { id: line.itemId, code: line.itemCode, serial: null, name: line.itemName, unitName: line.unitName, averageCost: line.unitCost };
    if (code && !byCode.has(code)) byCode.set(code, known);
    if (name && !byName.has(name)) byName.set(name, known);
  }
  const byWarehouse = new Map<string, string>();
  for (const warehouse of input.warehouses) {
    const code = (warehouse.code || '').trim().toLowerCase();
    const name = warehouse.name.trim().toLowerCase();
    if (code) byWarehouse.set(code, warehouse.id);
    if (name) byWarehouse.set(name, warehouse.id);
  }

  const next = input.lines.filter((line) => line.itemId || line.itemCode.trim()).map((line) => ({ ...line }));
  let matched = 0;
  let missed = 0;
  for (const row of input.rows) {
    const item =
      (row.code && byCode.get(row.code.trim().toLowerCase())) ||
      (row.name && byName.get(row.name.trim().toLowerCase())) ||
      undefined;
    if (!item) {
      missed += 1;
      continue;
    }
    matched += 1;
    const namedWarehouse = row.warehouse.trim()
      ? byWarehouse.get(row.warehouse.trim().toLowerCase()) || ''
      : '';
    const batch = row.batch.trim();
    const quantity = parseAmount(row.quantity);
    const unitCost = parseAmount(row.unitCost);
    const existing = namedWarehouse
      ? next.find(
          (line) =>
            line.itemId === item.id &&
            line.batchNumber === batch &&
            (line.warehouseId === namedWarehouse || !line.warehouseId)
        )
      : next.find(
          (line) =>
            line.itemId === item.id &&
            line.batchNumber === batch &&
            (!input.defaultWarehouseId || line.warehouseId === input.defaultWarehouseId)
        ) || next.find((line) => line.itemId === item.id && line.batchNumber === batch);
    if (existing) {
      if (namedWarehouse) existing.warehouseId = namedWarehouse;
      if (quantity != null) existing.quantity = quantity;
      if (unitCost != null) existing.unitCost = unitCost;
      if (row.expiry) existing.expiryDate = row.expiry.slice(0, 10);
      if (row.unit) existing.unitName = row.unit;
      continue;
    }
    next.push({
      itemId: item.id,
      itemCode: item.code || item.serial || row.code,
      itemName: item.name,
      unitName: row.unit || item.unitName,
      warehouseId: namedWarehouse || input.defaultWarehouseId,
      quantity: quantity ?? 0,
      unitCost: unitCost ?? item.averageCost,
      batchNumber: batch,
      expiryDate: row.expiry.slice(0, 10),
    });
  }
  return { next, matched, missed };
}
