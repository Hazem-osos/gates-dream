export const DELETE_CANCELLED_UNITS = [
  { id: 'JOURNAL_ENTRY', label: 'قيود يومية' },
  { id: 'INVOICE', label: 'فواتير (مبيعات / مشتريات / مردودات)' },
  { id: 'TREASURY_RECEIPT', label: 'سندات قبض' },
  { id: 'TREASURY_PAYMENT', label: 'سندات صرف' },
  { id: 'CASH_TRANSACTION', label: 'حركات نقدية (قبض / صرف)' },
  { id: 'SECURITIES_RECEIPT', label: 'أوراق قبض' },
  { id: 'SECURITIES_PAYMENT', label: 'أوراق دفع' },
  { id: 'SECURITIES_RENEWAL', label: 'تجديد أوراق' },
  { id: 'OPENING_STOCK', label: 'رصيد افتتاحي مخزن' },
  { id: 'STOCKTAKING', label: 'جرد مخزن' },
  { id: 'TRANSFER', label: 'نقل مخزني' },
  { id: 'ASSEMBLY', label: 'تجميع أصناف' },
  { id: 'DISASSEMBLY', label: 'تفكيك أصناف' },
  { id: 'RECEIPT', label: 'إذن إضافة مخزن' },
  { id: 'ISSUE', label: 'إذن صرف مخزن' },
  { id: 'ADJUSTMENT', label: 'تسوية مخزن' },
  { id: 'OTHER_ADJUSTMENT', label: 'إضافات / خصومات أخرى' },
  { id: 'LANDED_COST', label: 'تكاليف landed' },
  { id: 'PURCHASE_ORDER', label: 'أمر شراء' },
  { id: 'PURCHASE_RETURN', label: 'مردود مشتريات' },
  { id: 'PRICE_QUOTE', label: 'عرض سعر' },
  { id: 'SUPPLY_ORDER', label: 'أمر توريد' },
  { id: 'EXTRACT', label: 'مستخلصات مقاولات' },
] as const;

export type DeleteCancelledUnitId = (typeof DELETE_CANCELLED_UNITS)[number]['id'];

export const DEFAULT_DELETE_CANCELLED_UNIT_IDS: DeleteCancelledUnitId[] =
  DELETE_CANCELLED_UNITS.map((u) => u.id);
