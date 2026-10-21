export const FIX_AVERAGE_COST_UNITS = [
  { id: 'STOCK_ISSUE', label: 'اذن صرف مخزنى', journalOnly: true },
  { id: 'SALES_INVOICE', label: 'فاتورة مبيعات', journalOnly: true },
  { id: 'SALES_RETURN', label: 'مردودات مبيعات', journalOnly: true },
  { id: 'STOCK_TRANSFER', label: 'نقل مخزنى', journalOnly: false },
  { id: 'ASSEMBLY', label: 'تجميع الأصناف', journalOnly: false },
  { id: 'DISASSEMBLY', label: 'تفكيك الأصناف', journalOnly: false },
  { id: 'STOCKTAKING', label: 'تسوية جرد مخزنى', journalOnly: false },
  { id: 'MANUFACTURING', label: 'عملية تصنيع', journalOnly: false },
] as const;

export type FixAverageCostUnitId = (typeof FIX_AVERAGE_COST_UNITS)[number]['id'];

export const DEFAULT_FIX_AVERAGE_COST_UNIT_IDS: FixAverageCostUnitId[] =
  FIX_AVERAGE_COST_UNITS.map((u) => u.id);
