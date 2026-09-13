export const SELECTABLE_SOURCE_TYPES = [
  'QUOTATION',
  'SALES_ORDER',
  'PURCHASE_ORDER',
  'PURCHASE_INVOICE',
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
];

export const SOURCE_TYPE_LABELS: Record<SelectableSourceType, string> = {
  QUOTATION: 'عرض سعر',
  SALES_ORDER: 'أمر بيع',
  PURCHASE_ORDER: 'أمر شراء',
  PURCHASE_INVOICE: 'فاتورة مشتريات',
};

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
