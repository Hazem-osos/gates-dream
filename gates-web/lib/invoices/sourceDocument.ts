export const SELECTABLE_SOURCE_TYPES = [
  'QUOTATION',
  'SALES_ORDER',
  'PURCHASE_ORDER',
  'PURCHASE_INVOICE',
  'DELIVERY_NOTE',
  'GOODS_RECEIPT',
  'SALES_INVOICE',
] as const;

export type SelectableSourceType = (typeof SELECTABLE_SOURCE_TYPES)[number];
export type InvoiceSourceType = SelectableSourceType | 'NONE' | 'DELIVERY_NOTE';

export const SOURCE_TYPE_OPTIONS: Array<{
  value: SelectableSourceType;
  label: string;
  icon: string;
}> = [
  { value: 'QUOTATION', label: 'عرض سعر', icon: '📄' },
  { value: 'SALES_ORDER', label: 'أمر بيع', icon: '📦' },
  { value: 'PURCHASE_ORDER', label: 'أمر شراء', icon: '🛒' },
  { value: 'PURCHASE_INVOICE', label: 'فاتورة مشتريات', icon: '🧾' },
  { value: 'DELIVERY_NOTE', label: 'إذن صرف', icon: '📤' },
  { value: 'GOODS_RECEIPT', label: 'إذن إضافة', icon: '📥' },
  { value: 'SALES_INVOICE', label: 'فاتورة مبيعات', icon: '🧾' },
];

export const SOURCE_TYPE_LABELS: Record<SelectableSourceType, string> = {
  QUOTATION: 'عرض سعر',
  SALES_ORDER: 'أمر بيع',
  PURCHASE_ORDER: 'أمر شراء',
  PURCHASE_INVOICE: 'فاتورة مشتريات',
  DELIVERY_NOTE: 'إذن صرف',
  GOODS_RECEIPT: 'إذن إضافة',
  SALES_INVOICE: 'فاتورة مبيعات',
};

/** أقسام التحميل في فواتير المبيعات */
export const SALES_INVOICE_SOURCE_TYPES = [
  'QUOTATION',
  'SALES_ORDER',
  'DELIVERY_NOTE',
] as const satisfies readonly SelectableSourceType[];

/** أقسام التحميل في فواتير المشتريات */
export const PURCHASE_INVOICE_SOURCE_TYPES = [
  'PURCHASE_ORDER',
  'PURCHASE_INVOICE',
] as const satisfies readonly SelectableSourceType[];

/** مردود مبيعات — الفاتورة الأصلية المرحّلة */
export const SALES_RETURN_SOURCE_TYPES = ['SALES_INVOICE'] as const satisfies readonly SelectableSourceType[];

/** مردود مشتريات — فاتورة المشتريات */
export const PURCHASE_RETURN_SOURCE_TYPES = ['PURCHASE_INVOICE'] as const satisfies readonly SelectableSourceType[];

/** أمر شراء — تحميل من عرض سعر */
export const PURCHASE_ORDER_SOURCE_TYPES = ['QUOTATION'] as const satisfies readonly SelectableSourceType[];

/** إذن إضافة مخزني */
export const STOCK_RECEIPT_SOURCE_TYPES = [
  'PURCHASE_ORDER',
  'GOODS_RECEIPT',
  'PURCHASE_INVOICE',
] as const satisfies readonly SelectableSourceType[];

/** إذن صرف مخزني */
export const STOCK_ISSUE_SOURCE_TYPES = [
  'QUOTATION',
  'SALES_ORDER',
  'DELIVERY_NOTE',
  'SALES_INVOICE',
] as const satisfies readonly SelectableSourceType[];

/** تحويل مخزني */
export const STOCK_TRANSFER_SOURCE_TYPES = [
  'GOODS_RECEIPT',
  'DELIVERY_NOTE',
  'PURCHASE_ORDER',
  'PURCHASE_INVOICE',
] as const satisfies readonly SelectableSourceType[];

/** تسوية / جرد / إضافات مخزنية — نسخ بنود من مستندات تجارية */
export const STOCK_LINE_COPY_SOURCE_TYPES = [
  'GOODS_RECEIPT',
  'DELIVERY_NOTE',
  'PURCHASE_ORDER',
  'PURCHASE_INVOICE',
  'SALES_ORDER',
  'SALES_INVOICE',
  'QUOTATION',
] as const satisfies readonly SelectableSourceType[];

export type SourceDocumentListItem = {
  id: string;
  documentNumber: string;
  partyName: string;
  totalAmount: number;
  createdAt: string;
};

export type SourceHydrateLine = {
  itemId: string;
  itemName: string;
  quantity: number;
  unitId?: string;
  unitPrice: number;
  taxRate: number;
  withholdingTaxRate: number;
  discount: number;
  costCenterId?: string | null;
};

export type SourceHydratePayload = {
  sourceType: SelectableSourceType;
  sourceId: string;
  sourceNumber: string;
  customerId: string | null;
  supplierId: string | null;
  warehouseId: string | null;
  costCenterId: string | null;
  currencyId: string | null;
  delegateId: string | null;
  paymentMethod: string | null;
  partyName: string;
  lines: SourceHydrateLine[];
  notes: string;
};

export function mergeSourceNote(existing: string | undefined, note: string): string {
  const current = (existing ?? '').trim();
  const addition = note.trim();
  if (!addition) return current;
  if (current.includes(addition)) return current;
  return current ? `${current} — ${addition}` : addition;
}

export function formatSourceAmount(amount: number): string {
  return `${amount.toLocaleString('ar-EG', { maximumFractionDigits: 2 })} ج.م`;
}

export function sourceLineToSalesRow(
  line: SourceHydrateLine,
  warehouseId: string,
  applyTax: boolean
) {
  return {
    itemId: line.itemId,
    unitId: line.unitId ?? '',
    quantity: line.quantity || 1,
    baseQuantity: line.quantity || 1,
    conversionFactor: 1,
    baseUnitId: '',
    unitPrice: line.unitPrice || 0,
    discount: line.discount || 0,
    discountValue: line.discount || 0,
    discountType: 'PERCENTAGE' as const,
    taxRate: applyTax ? line.taxRate || 0 : 0,
    warehouseId,
    withholdingTaxRate: line.withholdingTaxRate || 0,
    withholdingTaxAmount: 0,
    costCenterId: line.costCenterId ?? '',
    color: '',
    size: '',
    customRevenueAccountId: '',
    batchAllocations: [],
  };
}

export function sourceLineToPurchaseRow(line: SourceHydrateLine, warehouseId: string) {
  return {
    itemId: line.itemId,
    unitId: line.unitId ?? '',
    quantity: line.quantity || 1,
    baseQuantity: line.quantity || 1,
    conversionFactor: 1,
    baseUnitId: '',
    unitPrice: line.unitPrice || 0,
    discount: line.discount || 0,
    discountValue: line.discount || 0,
    discountType: 'PERCENTAGE' as const,
    tax: line.taxRate || 0,
    warehouseId,
    withholdingTaxRate: line.withholdingTaxRate || 0,
    withholdingTaxAmount: 0,
    costCenterId: line.costCenterId ?? '',
  };
}
