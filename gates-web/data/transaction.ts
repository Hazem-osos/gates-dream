export type TransactionStationId = 'customer' | 'inventory' | 'accounting' | 'cash' | 'management';

export const TRANSACTION_STATIONS: Array<{
  id: TransactionStationId;
  label: { en: string; ar: string };
  detail: { en: string; ar: string };
}> = [
  { id: 'customer', label: { en: 'CUSTOMER', ar: 'العميل' }, detail: { en: 'Order recorded', ar: 'تم تسجيل الطلب' } },
  { id: 'inventory', label: { en: 'INVENTORY', ar: 'المخزون' }, detail: { en: 'Stock reduced', ar: 'انخفض المخزون' } },
  { id: 'accounting', label: { en: 'ACCOUNTING', ar: 'المحاسبة' }, detail: { en: 'Revenue posted', ar: 'أُثبت الإيراد' } },
  { id: 'cash', label: { en: 'CASH FLOW', ar: 'التدفق النقدي' }, detail: { en: 'Position updated', ar: 'تحدّث المركز' } },
  { id: 'management', label: { en: 'MANAGEMENT', ar: 'الإدارة' }, detail: { en: 'Dashboard updated', ar: 'تحدّثت اللوحة' } },
];
