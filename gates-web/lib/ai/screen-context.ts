import { resolveTabLabel } from '@/lib/navigation/tab-labels';

export type AiClientContext = {
  currentPath: string;
  pageTitle: string;
  documentId?: string;
  documentStatus?: string;
  formErrors?: string[];
};

const SCREEN_TITLES: Record<string, string> = {
  '/': 'لوحة التحكم',
  '/dashboard': 'لوحة التحكم',
  '/executive': 'لوحة الإدارة العليا',
  '/accounting/settings/transactions/payment-voucher': 'إعدادات سند الصرف',
  '/accounting/settings/transactions/receipt-voucher': 'إعدادات سند القبض',
  '/accounting/settings/transactions/bank-discount': 'إعدادات إشعار الخصم',
  '/accounting/settings/transactions/bank-addition': 'إعدادات إشعار الإضافة',
  '/inventory/settings/transactions/sales-invoice': 'إعدادات فاتورة المبيعات',
  '/inventory/settings/transactions/purchase-invoice': 'إعدادات فاتورة المشتريات',
  '/inventory/settings/transactions/sales-return': 'إعدادات مردودات المبيعات',
  '/inventory/settings/transactions/purchase-return': 'إعدادات مردودات المشتريات',
  '/inventory/settings/transactions/stock-issue': 'إعدادات إذن الصرف',
  '/inventory/settings/transactions/stock-receipt': 'إعدادات إذن الإضافة',
  '/growth': 'محرك النمو',
  '/growth/impact': 'أثر Gates',
  '/inventory/operations/sales-invoice': 'فاتورة مبيعات',
  '/inventory/operations/sales-returns': 'مردود مبيعات',
  '/inventory/operations/final-purchase-invoice': 'فاتورة مشتريات',
  '/inventory/operations/purchase-returns': 'مردود مشتريات',
  '/inventory/operations/price-quote': 'عرض سعر',
  '/inventory/operations/sales-order': 'أمر بيع',
  '/inventory/operations/purchase-order': 'أمر شراء',
  '/sales/quotes': 'عرض سعر',
  '/sales/orders': 'أمر بيع',
  '/inventory/operations/assembly': 'تجميع الأصناف',
  '/inventory/operations/disassembly': 'تفكيك الأصناف',
  '/inventory/disassembly': 'تفكيك الأصناف',
  '/inventory/assembly': 'تجميع الأصناف',
  '/inventory/operations/issue': 'إذن صرف مخزني',
  '/inventory/operations/opening-stock': 'بضاعة أول المدة',
  '/inventory/opening-stock': 'بضاعة أول المدة',
  '/inventory/operations/item-offers': 'عروض الأصناف',
  '/inventory/promotions/new': 'عروض الأصناف',
  '/accounting/operations/treasury/payment': 'سند صرف',
  '/accounting/operations/treasury/receipt': 'سند قبض',
  '/accounting/operations/securities/payment': 'ورقة مدفوعات',
  '/accounting/operations/securities/reciept': 'ورقة مقبوضات',
  '/accounting/operations/securities/bulk-create': 'إنشاء عدة أوراق',
  '/treasury/papers/batch-receipt/new': 'إنشاء عدة أوراق قبض',
  '/settings/document-profiles': 'أنماط المستندات',
  '/sales/invoices/new': 'فاتورة مبيعات',
  '/sales/returns/new': 'مردود مبيعات جديد',
  '/purchases/invoices/new': 'فاتورة مشتريات',
  '/purchases/returns/new': 'مردود مشتريات',
  '/accounting/vouchers/payment/new': 'سند صرف',
  '/accounting/vouchers/receipt/new': 'سند قبض',
  '/accounting/tax/wht-certificates': 'إشعارات خصم المنبع',
  '/accounting/tools/transfer-account': 'نقل حركة حساب',
  '/accounting/tools/transfer-cost-center': 'نقل حركة مركز التكلفة',
  '/accounting/operations/account-movement': 'نقل حركة حساب',
  '/accounting/operations/cost-center-movement': 'نقل حركة مركز التكلفة',
  '/accounting/operations/treasury/temp-receipt': 'إيصال استلام مؤقت',
  '/accounting/vouchers/temporary-receipt': 'إيصال استلام مؤقت',
  '/accounting/create/currencies': 'تعريف العملات',
  '/accounting/create/periods': 'الفترات المحاسبية',
  '/accounting/chart-of-accounts': 'دليل الحسابات',
  '/accounting/guide/cost-center': 'دليل مراكز التكلفة',
  '/inventory/guide/items': 'دليل الأصناف',
  '/inventory/creations/item-card': 'بطاقة الصنف',
  '/inventory/creations/stores': 'دليل المخازن',
  '/accounting/cards/customer': 'بطاقة عميل',
  '/accounting/cards/supplier': 'بطاقة مورد',
  '/accounting/cards/cost-center': 'بطاقة مركز تكلفة',
  '/accounting/cards/staff': 'إضافة مندوب',
  '/accounting/guide/customers-suppliers': 'دليل العملاء والموردين',
  '/accounting/cards/account': 'دليل الحسابات',
  '/accounting/cards/delegate': 'بطاقة مندوب',
};

function lookupTitle(pathname: string): string | undefined {
  if (SCREEN_TITLES[pathname]) return SCREEN_TITLES[pathname];
  const match = Object.entries(SCREEN_TITLES).find(
    ([path]) => pathname === path || pathname.startsWith(`${path}/`)
  );
  return match?.[1];
}

function looksLikeAppPath(value: string): boolean {
  const trimmed = value.trim();
  return !trimmed || trimmed.includes('/') || trimmed.startsWith('http');
}

export function resolveAiScreenContext(pathname: string): AiClientContext {
  const fromMap = lookupTitle(pathname);
  const fromTabs = resolveTabLabel(pathname);
  const docTitle =
    typeof document !== 'undefined' ? document.title.replace(/\s*[|·\-].*$/, '').trim() : '';
  const cleanDocTitle = looksLikeAppPath(docTitle) ? '' : docTitle;
  const pageTitle =
    (fromMap && !looksLikeAppPath(fromMap) ? fromMap : '') ||
    (fromTabs && !looksLikeAppPath(fromTabs) ? fromTabs : '') ||
    cleanDocTitle ||
    'صفحة داخل النظام';
  return { currentPath: pathname, pageTitle };
}

export function mergeAiClientContext(
  pathname: string,
  session?: { documentId?: string; documentStatus?: string; pageTitle?: string; formErrors?: string[] }
): AiClientContext {
  const base = resolveAiScreenContext(pathname);
  return {
    ...base,
    pageTitle: session?.pageTitle?.trim() || base.pageTitle,
    documentId: session?.documentId || base.documentId,
    documentStatus: session?.documentStatus,
    formErrors: session?.formErrors?.length ? session.formErrors : undefined,
  };
}
