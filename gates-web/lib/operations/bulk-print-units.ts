export const BULK_PRINT_UNITS = [
  { id: 'JOURNAL_ENTRY', label: 'قيود يومية' },
  { id: 'INVOICE', label: 'فواتير' },
  { id: 'TREASURY_RECEIPT', label: 'سندات قبض' },
  { id: 'TREASURY_PAYMENT', label: 'سندات صرف' },
  { id: 'SECURITIES_RECEIPT', label: 'أوراق قبض' },
  { id: 'SECURITIES_PAYMENT', label: 'أوراق دفع' },
  { id: 'RECEIPT', label: 'إذن إضافة' },
  { id: 'ISSUE', label: 'إذن صرف' },
  { id: 'TRANSFER', label: 'نقل مخزني' },
  { id: 'STOCKTAKING', label: 'جرد مخزن' },
  { id: 'PRICE_QUOTE', label: 'عرض سعر' },
  { id: 'PURCHASE_ORDER', label: 'أمر شراء' },
] as const;

export type BulkPrintUnitId = (typeof BULK_PRINT_UNITS)[number]['id'];

export const DEFAULT_BULK_PRINT_UNIT_IDS: BulkPrintUnitId[] = BULK_PRINT_UNITS.map((u) => u.id);
