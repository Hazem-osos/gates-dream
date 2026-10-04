export type InvoiceLineColumnId =
  | 'rowIndex'
  | 'item'
  | 'warehouse'
  | 'quantity'
  | 'unitPrice'
  | 'landedCost'
  | 'discount'
  | 'total'
  | 'rowDelete'
  | 'barcode'
  | 'unit'
  | 'baseUnit'
  | 'baseQuantity'
  | 'taxRate'
  | 'costCenter'
  | 'lineAccount'
  | 'batchAndExpiry'
  | 'batchNumber'
  | 'expiryDate'
  | 'notes'
  | 'productionDate'
  | 'serialNumbers'
  | 'taxExemptionReason'
  | 'withholdingTax'
  | 'withholdingAmount'
  | 'color'
  | 'size'
  | 'freeBonus'
  | 'unitConversion'
  | 'stockBalance';

export type InvoiceLineColumnGroupId =
  | 'costCenter'
  | 'withholdingTax'
  | 'colorAndSize'
  | 'batchAndExpiry'
  | 'serialsAndNotes'
  | 'revenueAccount';

export type InvoiceLineColumnDef = {
  id: InvoiceLineColumnId;
  labelAr: string;
  locked?: boolean;
  defaultVisible?: boolean;
  focusField?: string;
};

export type InvoiceLineColumnGroup = {
  id: InvoiceLineColumnGroupId;
  labelAr: string;
  columns: InvoiceLineColumnId[];
};

/** RTL display order: م → … → حذف. */
export const INVOICE_LINE_COLUMN_DEFS: InvoiceLineColumnDef[] = [
  { id: 'rowIndex', labelAr: 'م', locked: true, defaultVisible: true },
  { id: 'item', labelAr: 'الصنف', locked: true, defaultVisible: true, focusField: 'item' },
  { id: 'notes', labelAr: 'ملاحظات', defaultVisible: true, focusField: 'notes' },
  { id: 'barcode', labelAr: 'الباركود', defaultVisible: false, focusField: 'barcode' },
  { id: 'warehouse', labelAr: 'المخزن', locked: true, defaultVisible: true, focusField: 'warehouse' },
  { id: 'stockBalance', labelAr: 'الكمية المتاحة', locked: true, defaultVisible: true },
  { id: 'unit', labelAr: 'الوحدة', locked: true, defaultVisible: true, focusField: 'unit' },
  { id: 'baseUnit', labelAr: 'الوحدة الأساسية', locked: true, defaultVisible: true },
  { id: 'baseQuantity', labelAr: 'كمية الوحدة الأساسية', defaultVisible: false, focusField: 'baseQuantity' },
  { id: 'quantity', labelAr: 'الكمية', locked: true, defaultVisible: true, focusField: 'quantity' },
  { id: 'unitPrice', labelAr: 'السعر', locked: true, defaultVisible: true, focusField: 'unitPrice' },
  { id: 'landedCost', labelAr: 'سعر الوحدة الفعلي', defaultVisible: false },
  { id: 'discount', labelAr: 'الخصم', locked: true, defaultVisible: true, focusField: 'discount' },
  { id: 'taxRate', labelAr: 'ضريبة القيمة المضافة (ض.ق.م)', locked: true, defaultVisible: true, focusField: 'taxRate' },
  { id: 'withholdingTax', labelAr: 'خصم المنبع', defaultVisible: false, focusField: 'withholdingTax' },
  { id: 'withholdingAmount', labelAr: 'قيمة الخصم', defaultVisible: false, focusField: 'withholdingAmount' },
  { id: 'total', labelAr: 'الإجمالي', locked: true, defaultVisible: true },
  { id: 'costCenter', labelAr: 'مركز التكلفة', defaultVisible: false, focusField: 'costCenter' },
  { id: 'lineAccount', labelAr: 'حساب إيراد مخصص', defaultVisible: false, focusField: 'lineAccount' },
  { id: 'color', labelAr: 'اللون', defaultVisible: false, focusField: 'color' },
  { id: 'size', labelAr: 'المقاس', defaultVisible: false, focusField: 'size' },
  { id: 'batchAndExpiry', labelAr: 'التشغيلة / الصلاحية', defaultVisible: false, focusField: 'batchAndExpiry' },
  { id: 'batchNumber', labelAr: 'رقم التشغيلة', defaultVisible: false, focusField: 'batchNumber' },
  { id: 'expiryDate', labelAr: 'تاريخ الصلاحية', defaultVisible: false, focusField: 'expiryDate' },
  { id: 'productionDate', labelAr: 'تاريخ الإنتاج', defaultVisible: false, focusField: 'productionDate' },
  { id: 'serialNumbers', labelAr: 'الأرقام المسلسلة', defaultVisible: false, focusField: 'serialNumbers' },
  {
    id: 'taxExemptionReason',
    labelAr: 'سبب الإعفاء الضريبي',
    defaultVisible: false,
    focusField: 'taxExemptionReason',
  },
  { id: 'freeBonus', labelAr: 'هدية', defaultVisible: false, focusField: 'freeBonus' },
  { id: 'unitConversion', labelAr: 'معامل التحويل', defaultVisible: false },
  { id: 'rowDelete', labelAr: '', locked: true, defaultVisible: true },
];

export const INVOICE_LINE_COLUMN_GROUPS: InvoiceLineColumnGroup[] = [
  { id: 'costCenter', labelAr: 'مركز التكلفة', columns: ['costCenter'] },
  { id: 'withholdingTax', labelAr: 'خصم المنبع', columns: ['withholdingTax', 'withholdingAmount'] },
  { id: 'colorAndSize', labelAr: 'اللون والمقاس', columns: ['color', 'size'] },
  { id: 'batchAndExpiry', labelAr: 'التشغيلة والصلاحية', columns: ['batchAndExpiry'] },
  { id: 'serialsAndNotes', labelAr: 'السيريال والملاحظات', columns: ['serialNumbers', 'notes'] },
  { id: 'revenueAccount', labelAr: 'حساب إيراد مخصص', columns: ['lineAccount'] },
];

export type InvoiceColumnStorageKey = 'gates:columns:sales-invoice' | 'gates:columns:purchase-invoice';

/** Bump when locked/default columns change so browsers pick up new layout. */
const COLUMN_LAYOUT_VERSION = 8;

export const SALES_INVOICE_STORAGE_DEFAULT: InvoiceLineColumnId[] = [
  'rowIndex',
  'item',
  'notes',
  'warehouse',
  'stockBalance',
  'unit',
  'baseUnit',
  'quantity',
  'unitPrice',
  'discount',
  'taxRate',
  'total',
  'rowDelete',
];

export const PURCHASE_INVOICE_STORAGE_DEFAULT: InvoiceLineColumnId[] = [
  'rowIndex',
  'item',
  'notes',
  'warehouse',
  'stockBalance',
  'unit',
  'baseUnit',
  'quantity',
  'unitPrice',
  'landedCost',
  'discount',
  'taxRate',
  'total',
  'rowDelete',
];

const DEFAULT_VISIBLE = INVOICE_LINE_COLUMN_DEFS.filter((c) => c.defaultVisible !== false).map(
  (c) => c.id
);

function defaultVisibleForKey(storageKey: InvoiceColumnStorageKey): InvoiceLineColumnId[] {
  if (storageKey === 'gates:columns:sales-invoice') {
    return SALES_INVOICE_STORAGE_DEFAULT;
  }
  if (storageKey === 'gates:columns:purchase-invoice') {
    return PURCHASE_INVOICE_STORAGE_DEFAULT;
  }
  return DEFAULT_VISIBLE;
}

export function invoiceGridColumnsStorageKey(companyId?: string | null) {
  return companyId ? `invoice_grid_columns_${companyId}` : 'invoice_grid_columns_default';
}

/** SSR-safe default (no localStorage). Use for useState initial value. */
export function getDefaultVisibleColumnIds(storageKey: InvoiceColumnStorageKey): InvoiceLineColumnId[] {
  return defaultVisibleForKey(storageKey);
}

function lockedIds() {
  return INVOICE_LINE_COLUMN_DEFS.filter((c) => c.locked).map((c) => c.id);
}

function mergeVisible(parsed: InvoiceLineColumnId[], fallback: InvoiceLineColumnId[]): InvoiceLineColumnId[] {
  const allowed = new Set(INVOICE_LINE_COLUMN_DEFS.map((c) => c.id));
  const visibleSet = new Set<InvoiceLineColumnId>([
    ...lockedIds(),
    ...parsed.filter((id) => allowed.has(id)),
  ]);
  if (visibleSet.has('withholdingTax') || visibleSet.has('withholdingAmount')) {
    visibleSet.add('withholdingTax');
    visibleSet.add('withholdingAmount');
  }
  const merged = INVOICE_LINE_COLUMN_DEFS.filter((c) => visibleSet.has(c.id)).map((c) => c.id);
  return merged.length ? merged : fallback;
}

export function loadVisibleColumnIds(
  storageKey: InvoiceColumnStorageKey,
  companyId?: string | null
): InvoiceLineColumnId[] {
  const fallback = defaultVisibleForKey(storageKey);
  if (typeof window === 'undefined') return fallback;
  try {
    const companyKey = invoiceGridColumnsStorageKey(companyId);
    const versionKey = `${companyKey}:layoutVersion`;
    const storedVersion = Number(localStorage.getItem(versionKey) ?? '1');
    if (storedVersion < COLUMN_LAYOUT_VERSION) {
      localStorage.setItem(versionKey, String(COLUMN_LAYOUT_VERSION));
      return fallback;
    }
    const raw = localStorage.getItem(companyKey) ?? localStorage.getItem(storageKey);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw) as InvoiceLineColumnId[];
    return mergeVisible(parsed, fallback);
  } catch {
    return fallback;
  }
}

export function saveVisibleColumnIds(
  storageKey: InvoiceColumnStorageKey,
  ids: InvoiceLineColumnId[],
  companyId?: string | null
) {
  if (typeof window === 'undefined') return;
  const locked = new Set(lockedIds());
  const toSave = ids.filter((id) => !locked.has(id));
  const companyKey = invoiceGridColumnsStorageKey(companyId);
  localStorage.setItem(companyKey, JSON.stringify(toSave));
  localStorage.setItem(`${companyKey}:layoutVersion`, String(COLUMN_LAYOUT_VERSION));
  localStorage.setItem(storageKey, JSON.stringify(toSave));
}

/** خصم المنبع وقيمة الخصم يظهران معًا لما الضربة تكون مفعّلة. */
export function ensureWithholdingColumns(ids: InvoiceLineColumnId[]): InvoiceLineColumnId[] {
  if (ids.includes('withholdingTax') && ids.includes('withholdingAmount')) return ids;
  const set = new Set(ids);
  set.add('withholdingTax');
  set.add('withholdingAmount');
  return INVOICE_LINE_COLUMN_DEFS.filter((c) => set.has(c.id)).map((c) => c.id);
}

export function mergeVisibleColumnIds(
  storageKey: InvoiceColumnStorageKey,
  ids: InvoiceLineColumnId[]
): InvoiceLineColumnId[] {
  const set = new Set<InvoiceLineColumnId>([...defaultVisibleForKey(storageKey), ...ids]);
  return INVOICE_LINE_COLUMN_DEFS.filter((d) => set.has(d.id)).map((d) => d.id);
}

export function buildFocusFieldOrder(visibleIds: InvoiceLineColumnId[]): string[] {
  const order: string[] = [];
  for (const def of INVOICE_LINE_COLUMN_DEFS) {
    if (!visibleIds.includes(def.id)) continue;
    if (def.focusField && !order.includes(def.focusField)) {
      order.push(def.focusField);
    }
  }
  return order;
}

export function groupIsActive(visibleIds: InvoiceLineColumnId[], group: InvoiceLineColumnGroup) {
  return group.columns.every((id) => visibleIds.includes(id));
}

export function toggleColumnGroup(
  visibleIds: InvoiceLineColumnId[],
  group: InvoiceLineColumnGroup
): InvoiceLineColumnId[] {
  const next = new Set(visibleIds);
  const on = groupIsActive(visibleIds, group);
  for (const id of group.columns) {
    if (on) next.delete(id);
    else next.add(id);
  }
  for (const id of lockedIds()) next.add(id);
  return INVOICE_LINE_COLUMN_DEFS.filter((c) => next.has(c.id)).map((c) => c.id);
}

/** Columns shown in «تخصيص الأعمدة». قيمة الخصم follows خصم المنبع and is not a separate checkbox. */
export const CUSTOMIZABLE_INVOICE_COLUMNS = INVOICE_LINE_COLUMN_DEFS.filter(
  (c) => c.id !== 'rowDelete' && c.id !== 'withholdingAmount'
);

export function toggleColumn(
  visibleIds: InvoiceLineColumnId[],
  columnId: InvoiceLineColumnId
): InvoiceLineColumnId[] {
  const def = INVOICE_LINE_COLUMN_DEFS.find((c) => c.id === columnId);
  if (!def || def.locked) return visibleIds;
  const next = new Set(visibleIds);
  if (next.has(columnId)) next.delete(columnId);
  else next.add(columnId);
  if (columnId === 'withholdingTax' || columnId === 'withholdingAmount') {
    if (next.has(columnId)) {
      next.add('withholdingTax');
      next.add('withholdingAmount');
    } else {
      next.delete('withholdingTax');
      next.delete('withholdingAmount');
    }
  }
  for (const id of lockedIds()) next.add(id);
  return INVOICE_LINE_COLUMN_DEFS.filter((c) => next.has(c.id)).map((c) => c.id);
}

export type InvoiceLineBatchAllocation = {
  batchId?: string;
  batchNumber: string;
  qty: number;
  expiryDate?: string | null;
};

export type InvoiceLineExtended = {
  warehouseId?: string;
  barcode?: string;
  costCenterId?: string;
  lineAccountId?: string;
  customRevenueAccountId?: string;
  batchNumber?: string;
  expiryDate?: string;
  productionDate?: string;
  serialNumbers?: string;
  lineNotes?: string;
  taxExemptionReason?: string;
  withholdingTaxRate?: number;
  withholdingTaxAmount?: number;
  withholdingAmountManual?: boolean;
  batchAllocations?: InvoiceLineBatchAllocation[];
  color?: string;
  size?: string;
  originalInvoiceLineId?: string;
};

export const emptyExtendedLineFields = (): InvoiceLineExtended => ({});
