export const RENUMBER_INPUT_UNITS = [
  { id: 'JOURNAL_ENTRY', label: 'قيود يومية' },
  { id: 'INVOICE', label: 'فواتير (كل الأنواع)' },
  { id: 'TREASURY_RECEIPT', label: 'سندات قبض' },
  { id: 'TREASURY_PAYMENT', label: 'سندات صرف' },
  { id: 'CASH_TRANSACTION', label: 'حركات نقدية' },
  { id: 'SECURITIES_RECEIPT', label: 'أوراق قبض' },
  { id: 'SECURITIES_PAYMENT', label: 'أوراق دفع' },
  { id: 'SECURITIES_RENEWAL', label: 'تجديد أوراق' },
  { id: 'OPENING_STOCK', label: 'رصيد افتتاحي' },
  { id: 'STOCKTAKING', label: 'جرد مخزن' },
  { id: 'TRANSFER', label: 'نقل مخزني' },
  { id: 'ASSEMBLY', label: 'تجميع' },
  { id: 'DISASSEMBLY', label: 'تفكيك' },
  { id: 'RECEIPT', label: 'إذن إضافة' },
  { id: 'ISSUE', label: 'إذن صرف' },
  { id: 'ADJUSTMENT', label: 'تسوية مخزن' },
  { id: 'OTHER_ADJUSTMENT', label: 'إضافات / خصومات أخرى' },
  { id: 'PURCHASE_ORDER', label: 'أمر شراء' },
  { id: 'PURCHASE_RETURN', label: 'مردود مشتريات' },
  { id: 'PRICE_QUOTE', label: 'عرض سعر' },
  { id: 'SUPPLY_ORDER', label: 'أمر توريد' },
] as const;

export type RenumberInputUnitId = (typeof RENUMBER_INPUT_UNITS)[number]['id'];

export const DEFAULT_RENUMBER_INPUT_UNIT_IDS: RenumberInputUnitId[] =
  RENUMBER_INPUT_UNITS.map((u) => u.id);
