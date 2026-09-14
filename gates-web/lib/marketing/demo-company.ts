export const DEMO_COMPANY = {
  company: {
    ar: 'شركة النور للصناعات والتجارة',
    en: 'Al-Nour Industries & Trading',
  },
  customer: {
    ar: 'شركة النيل',
    en: 'Nile Trading',
  },
  sku: 'A12',
  skuName: {
    ar: 'وحدة تامة A12',
    en: 'Finished unit A12',
  },
  saleId: 'POS-2081',
  qty: 1,
  amount: '84,250',
  currency: {
    ar: 'ج.م',
    en: 'EGP',
  },
  warehouseAfterAct1: 123,
  warehouseAfterRetail: 122,
  retailShelf: 8,
  reorderPoint: 20,
  restockQty: 20,
  expectedAfterPurchase: 28,
  supplier: {
    ar: 'مورد المواد A',
    en: 'Supplier A',
  },
  journalId: 'JE-2081',
  draftId: 'DRAFT-PI-441',
  unitCost: '2,140',
  draftTotal: '42,800',
  branchRetail: {
    ar: 'تجزئة القاهرة',
    en: 'Cairo retail',
  },
} as const;

export type DemoLocale = 'ar' | 'en';

export function demoText(
  field: { readonly ar: string; readonly en: string },
  locale: DemoLocale
): string {
  return field[locale];
}
