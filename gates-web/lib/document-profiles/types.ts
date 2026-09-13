export type DocumentBaseType =
  | 'SALES_INVOICE'
  | 'PURCHASE_INVOICE'
  | 'PAYMENT_VOUCHER'
  | 'RECEIPT_VOUCHER'
  | 'STOCK_ISSUE'
  | 'STOCK_RECEIPT'
  | 'SALES_RETURN'
  | 'PURCHASE_RETURN';

export type DocumentProfileColumnKey =
  | 'colorAndSize'
  | 'batchAndExpiry'
  | 'withholdingTax'
  | 'costCenter'
  | 'serialsAndNotes';

export type DocumentProfile = {
  id: string;
  companyId: string;
  slug: string;
  nameAr: string;
  nameEn?: string | null;
  baseType: DocumentBaseType;
  prefix?: string | null;
  nextNumber: number;
  defaultWarehouseId?: string | null;
  lockWarehouse: boolean;
  defaultTreasuryId?: string | null;
  lockTreasury: boolean;
  defaultCostCenterId?: string | null;
  lockCostCenter: boolean;
  visibleColumns: DocumentProfileColumnKey[] | string[];
  showInSidebar: boolean;
  isActive: boolean;
  defaultWarehouse?: { id: string; code?: string | null; arabicName: string } | null;
  defaultTreasury?: { id: string; code?: string | null; arabicName: string } | null;
  defaultCostCenter?: { id: string; code?: string | null; arabicName: string } | null;
};

export const DOCUMENT_BASE_TYPE_LABELS: Record<DocumentBaseType, string> = {
  SALES_INVOICE: 'فاتورة مبيعات',
  PURCHASE_INVOICE: 'فاتورة مشتريات',
  PAYMENT_VOUCHER: 'سند صرف',
  RECEIPT_VOUCHER: 'سند قبض',
  STOCK_ISSUE: 'سند صرف مخزني',
  STOCK_RECEIPT: 'سند إضافة مخزني',
  SALES_RETURN: 'مردود مبيعات',
  PURCHASE_RETURN: 'مردود مشتريات',
};

export const DOCUMENT_PROFILE_COLUMN_OPTIONS: { id: DocumentProfileColumnKey; labelAr: string }[] = [
  { id: 'colorAndSize', labelAr: 'اللون والمقاس (الملابس والتجزئة)' },
  { id: 'batchAndExpiry', labelAr: 'رقم الباتش وتاريخ الصلاحية' },
  { id: 'withholdingTax', labelAr: 'ضريبة خصم المنبع (WHT)' },
  { id: 'costCenter', labelAr: 'مركز التكلفة للسطر' },
  { id: 'serialsAndNotes', labelAr: 'أرقام السيريال' },
];

export function slugifyProfileName(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\u0600-\u06FF]+/g, '-')
    .replace(/[\u0600-\u06FF]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 48);
}

export function profileEntryHref(profile: Pick<DocumentProfile, 'baseType' | 'slug'>) {
  const q = `profile=${encodeURIComponent(profile.slug)}`;
  switch (profile.baseType) {
    case 'SALES_INVOICE':
      return `/inventory/operations/sales-invoice?${q}`;
    case 'PURCHASE_INVOICE':
      return `/inventory/operations/final-purchase-invoice?${q}`;
    case 'PAYMENT_VOUCHER':
      return `/accounting/operations/treasury/payment-voucher?${q}`;
    case 'RECEIPT_VOUCHER':
      return `/accounting/operations/treasury/receipt-voucher?${q}`;
    case 'STOCK_ISSUE':
      return `/inventory/operations/issue?${q}`;
    case 'STOCK_RECEIPT':
      return `/inventory/operations/receipt?${q}`;
    case 'SALES_RETURN':
      return `/inventory/operations/sales-returns?${q}`;
    case 'PURCHASE_RETURN':
      return `/inventory/operations/purchase-returns?${q}`;
    default:
      return `/inventory/operations/sales-invoice?${q}`;
  }
}

export function previewProfileNumber(profile: Pick<DocumentProfile, 'prefix' | 'nextNumber'>) {
  return `${profile.prefix ?? ''}${String(profile.nextNumber ?? 1).padStart(4, '0')}`;
}
