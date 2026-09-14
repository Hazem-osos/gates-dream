export type TransactionStationId =
  | 'sale'
  | 'inventory'
  | 'accounting'
  | 'customer'
  | 'cash'
  | 'management';

export const TRANSACTION_STATIONS: Array<{
  id: TransactionStationId;
  index: string;
  label: { en: string; ar: string };
  detail: { en: string; ar: string };
}> = [
  {
    id: 'sale',
    index: '01',
    label: { en: 'SALE CREATED', ar: 'تم إنشاء البيع' },
    detail: { en: 'Order captured', ar: 'سُجّل الطلب' },
  },
  {
    id: 'inventory',
    index: '02',
    label: { en: 'INVENTORY UPDATED', ar: 'تحدّث المخزون' },
    detail: { en: 'Stock reserved', ar: 'حُجز المخزون' },
  },
  {
    id: 'accounting',
    index: '03',
    label: { en: 'ACCOUNTING POSTED', ar: 'أُثبتت المحاسبة' },
    detail: { en: 'Journal posted', ar: 'أُثبت القيد' },
  },
  {
    id: 'customer',
    index: '04',
    label: { en: 'CUSTOMER BALANCE UPDATED', ar: 'تحدّث رصيد العميل' },
    detail: { en: 'Receivable moved', ar: 'تحرّكت الذمم' },
  },
  {
    id: 'cash',
    index: '05',
    label: { en: 'CASH FLOW UPDATED', ar: 'تحدّث التدفق النقدي' },
    detail: { en: 'Liquidity refreshed', ar: 'تحدّثت السيولة' },
  },
  {
    id: 'management',
    index: '06',
    label: { en: 'MANAGEMENT DASHBOARD UPDATED', ar: 'تحدّثت لوحة الإدارة' },
    detail: { en: 'Live KPI refresh', ar: 'تحدّثت المؤشرات' },
  },
];
