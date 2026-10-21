import {
  accountingModules,
  accountingSettingsModules,
  posModules,
} from '@/app/components/Sidebar';
import { inventoryModules } from '@/app/components/InventorySidebar';
import { extractsModules } from '@/app/components/ExtractsSidebar';
import { manufacturingModules } from '@/app/components/ManufacturingSidebar';
import { exportImportModules } from '@/app/components/ExportImportSidebar';
import { electronicInvoicesModules } from '@/app/components/ElectronicInvoicesSidebar';
import { estsmar3akaryModules } from '@/app/components/SidebarEstsmar3akary';
import { hrModules } from '@/app/components/hr/hr-sidebar.config';
import { WORKSPACE_HUB_GROUPS } from '@/lib/navigation/workspace-hub-directory';
import { contextFromSettingsSlug } from '@/lib/transaction-settings/types';

type NavLike = {
  label: string;
  href?: string;
  children?: NavLike[];
};

const PATH_LABEL_EXACT: Record<string, string> = {
  '/': 'لوحة التحكم',
  '/dashboard': 'لوحة التحكم',
  '/executive': 'لوحة الإدارة العليا',
  '/profile': 'الملف الشخصي',
  '/onboarding': 'التهيئة الأولى',
  '/inventory': 'المخازن',
  '/growth': 'محرك النمو',
  '/growth/impact': 'أثر Gates',
  '/sales': 'المبيعات والعملاء',
  '/purchases': 'المشتريات والموردين',
  '/inventory/guide': 'دليل المخازن',
  '/inventory/guide/items': 'دليل الأصناف',
  '/inventory/creations/stores': 'بطاقة المخزن',
  '/inventory/creations/item-card': 'بطاقة الصنف',
  '/accounting': 'الحسابات العامة',
  '/accounting/cards/customer-group': 'مجموعة العميل',
  '/accounting/cards/supplier-group': 'مجموعة المورد',
  '/accounting/guide/representatives-guide': 'دليل المندوبين والتوزيع',
  '/accounting/cards/staff': 'إضافة مندوب',
  '/accounting/cards/delegate': 'بطاقة مندوب',
  '/accounting/cards/driver': 'بطاقة سائق',
  '/accounting/cards/distributor': 'بطاقة موزع',
  '/accounting/cards/safe': 'بطاقة خزنة',
  '/accounting/cards/bank-account': 'بطاقة حساب بنكي',
  '/accounting-settings': 'الإعدادات المحاسبية',
  '/accounting-settings/operations-management/fix-average-cost': 'إصلاح متوسط التكلفة',
  '/accounting-settings/operations-management/fix-inventory-journals': 'اصلاح قيود المخزون',
  '/extracts': 'المستخلصات',
  '/extracts/operations/execution-plan-distribution': 'توزيع مخطط التنفيذ',
  '/extracts/operations/projects/execution-plan': 'مخطط التنفيذ',
  '/hr': 'الموارد البشرية',
  '/manufacturing': 'التصنيع والإنتاج',
  '/manufacturing/settings': 'إعدادات التصنيع',
  '/manufacturing/settings/transactions/manufacturing-order': 'إعدادات عملية التصنيع',
  '/manufacturing/settings/transactions/manufacturing-work-order': 'إعدادات أمر الشغل',
  '/importexport': 'الاستيراد والتصدير',
  '/electronic-invoices': 'الفواتير الإلكترونية',
  '/real-estate-investment': 'الاستثمار العقاري',
  '/real-estate': 'التطوير العقاري والمحفظة',
  '/real-estate/contracts': 'عقود الوحدات',
  '/real-estate/cheques': 'محفظة الشيكات الآجلة',
  '/real-estate/resale': 'إعادة البيع والتنازل',
  '/real-estate/rental-pools': 'توزيع إيجار المجمع',
  '/pos': 'نقاط البيع',
  '/inventory/settings': 'إعدادات المخازن',
  '/inventory/settings/transactions/sales-invoice': 'إعدادات فاتورة المبيعات',
  '/inventory/settings/transactions/purchase-invoice': 'إعدادات فاتورة المشتريات',
  '/inventory/settings/transactions/sales-return': 'إعدادات مردودات المبيعات',
  '/inventory/settings/transactions/purchase-return': 'إعدادات مردودات المشتريات',
  '/inventory/settings/transactions/stock-issue': 'إعدادات إذن الصرف',
  '/inventory/settings/transactions/stock-receipt': 'إعدادات إذن الإضافة',
  '/inventory/settings/transactions/stock-transfer': 'إعدادات تحويل مخزني',
  '/inventory/settings/transactions/stock-stocktaking': 'إعدادات الجرد',
  '/inventory/settings/transactions/stock-other-adjustment': 'إعدادات تسوية أخرى',
  '/inventory/settings/transactions/opening-stock': 'إعدادات بضاعة أول المدة',
  '/inventory/settings/transactions/stock-assembly': 'إعدادات تجميع أصناف',
  '/inventory/settings/transactions/stock-disassembly': 'إعدادات تفكيك أصناف',
  '/inventory/settings/transactions/purchase-order': 'إعدادات أمر الشراء',
  '/inventory/settings/transactions/price-quote': 'إعدادات عرض السعر',
  '/inventory/settings/transactions/sales-order': 'إعدادات أمر البيع',
  '/accounting/settings/transactions/payment-voucher': 'إعدادات سند الصرف',
  '/accounting/settings/transactions/receipt-voucher': 'إعدادات سند القبض',
  '/accounting/settings/transactions/journal-entry': 'إعدادات قيد اليومية',
  '/accounting/settings/transactions/opening-balance': 'إعدادات الرصيد الافتتاحي',
  '/accounting/settings/transactions/bank-discount': 'إعدادات إشعار الخصم',
  '/accounting/settings/transactions/bank-addition': 'إعدادات إشعار الإضافة',
  '/accounting/operations/securities/receipt': 'ورقة مقبوضات',
  '/accounting/operations/securities/payment': 'ورقة مدفوعات',
  '/accounting/operations/securities/payment/bulk': 'إنشاء عدة أوراق دفع',
  '/accounting/settings/transactions/securities-receipt': 'إعدادات ورقة المقبوضات',
  '/accounting/settings/transactions/securities-payment': 'إعدادات ورقة المدفوعات',
  '/accounting/settings/transactions/payment-order': 'إعدادات أمر صرف نقدية',
  '/accounting/settings/transactions/receipt-order': 'إعدادات أمر توريد نقدية',
  '/accounting/settings/transactions/temporary-receipt': 'إعدادات إيصال استلام مؤقت',
  '/accounting/settings/transactions/cheque-receipt': 'إعدادات شيكات القبض',
  '/accounting/settings/transactions/cheque-payment': 'إعدادات شيكات الدفع',
  '/accounting/settings/transactions/opening-securities-receipt': 'إعدادات أوراق مالية سابقة (قبض)',
  '/accounting/settings/transactions/opening-securities-payment': 'إعدادات أوراق مالية سابقة (دفع)',
  '/contracting': 'لوحة المقاولات',
  '/contracting/tenders': 'العطاءات',
  '/contracting/tenders/new': 'عطاء جديد',
  '/extracts/operations/tender-price-quote': 'عرض سعر',
  '/extracts/operations/client-contract': 'تعاقد مع العميل',
  '/extracts/operations/contract-deduction-definition': 'تعريف الخصومات',
  '/contracting/extracts': 'مستخلصات العقود (أرشيف)',
  '/contracting/projects': 'المشاريع',
  '/contracting/reports': 'تقارير المقاولات',
  '/subcontracts': 'لوحة مقاولي الباطن',
  '/subcontracts/directory': 'بطاقة مقاول الباطن',
  '/subcontracts/contracts': 'سجل عقود الباطن',
  '/subcontracts/reports/tax-form-41': 'نموذج 41 — خصم المنبع',
};

const SEGMENT_LABELS: Record<string, string> = {
  profile: 'الملف الشخصي',
  dashboard: 'لوحة التحكم',
  executive: 'لوحة الإدارة العليا',
  onboarding: 'التهيئة الأولى',
  'sales-invoice': 'فاتورة مبيعات',
  'purchase-order': 'أمر شراء',
  'price-quote': 'عرض سعر',
  'tender-price-quote': 'عرض سعر',
  'client-contract': 'تعاقد مع العميل',
  assembly: 'تجميع الأصناف',
  growth: 'النمو',
  impact: 'أثر Gates',
  disassembly: 'تفكيك الأصناف',
  'sales-order': 'أمر بيع',
  'sales-returns': 'مردودات مبيعات',
  'purchase-returns': 'مردودات مشتريات',
  'final-purchase-invoice': 'فاتورة مشتريات',
  stores: 'بطاقة المخزن',
  'item-card': 'بطاقة الصنف',
  'chart-of-accounts': 'شجرة الحسابات',
  'representatives-guide': 'دليل المندوبين والتوزيع',
  'journal-entry': 'قيد يومية',
  receipt: 'إذن إضافة مخزني',
  issue: 'إذن صرف مخزني',
  transfer: 'نقل مخزني',
  stocktaking: 'تسوية الجرد المخزني',
  'make-extract': 'مستخلصات المقاولات',
  'execution-plan-distribution': 'توزيع مخطط التنفيذ',
  'execution-plan': 'مخطط التنفيذ',
  contractor: 'تعريف المقاول',
  subcontracts: 'مقاولو الباطن',
  invoices: 'المستخلصات',
  'tax-form-41': 'نموذج 41',
  'cash-payment': 'أمر صرف نقدية',
  'cash-receipt': 'أمر توريد نقدية',
  'payment-voucher': 'سند صرف',
  'receipt-voucher': 'سند قبض',
  'bank-discount': 'إشعار خصم بنكي',
  'bank-debit': 'إشعار خصم بنكي',
  'bank-addition': 'إشعار إضافة بنكي',
  'bank-credit': 'إشعار إضافة بنكي',
  customer: 'بطاقة عميل',
  supplier: 'بطاقة مورد',
  staff: 'إضافة مندوب',
  delegate: 'بطاقة مندوب',
  driver: 'بطاقة سائق',
  distributor: 'بطاقة موزع',
  'customer-group': 'مجموعة العميل',
  'supplier-group': 'مجموعة المورد',
  creations: 'التعريفات',
  operations: 'العمليات',
  reports: 'التقارير',
  settings: 'الإعدادات',
  projects: 'المشاريع',
  contracting: 'المقاولات',
  'technical-office': 'المكتب الفني',
  'client-billing': 'مستخلصات المالك',
  'letters-of-guarantee': 'خطابات الضمان',
  'cost-control': 'مراقبة التكاليف',
  login: 'تسجيل الدخول',
  register: 'إنشاء حساب',
};

function normalizePath(pathname: string): string {
  const base = pathname.split('?')[0]?.split('#')[0] ?? pathname;
  if (base.length > 1 && base.endsWith('/')) return base.slice(0, -1);
  return base || '/';
}

function indexNav(nodes: NavLike[], map: Map<string, string>) {
  for (const node of nodes) {
    if (node.href) {
      map.set(normalizePath(node.href), node.label);
    }
    if (node.children?.length) {
      indexNav(node.children, map);
    }
  }
}

function buildHrefLabelIndex(): Map<string, string> {
  const map = new Map<string, string>();
  const trees: NavLike[][] = [
    inventoryModules,
    accountingModules,
    accountingSettingsModules,
    posModules,
    extractsModules,
    manufacturingModules,
    exportImportModules,
    electronicInvoicesModules,
    estsmar3akaryModules,
    hrModules,
  ];
  for (const tree of trees) {
    indexNav(tree, map);
  }
  for (const group of WORKSPACE_HUB_GROUPS) {
    for (const link of group.links) {
      map.set(normalizePath(link.href), link.label);
    }
  }
  for (const [path, label] of Object.entries(PATH_LABEL_EXACT)) {
    map.set(normalizePath(path), label);
  }
  return map;
}

let hrefLabelIndex: Map<string, string> | null = null;

function getHrefLabelIndex(): Map<string, string> {
  if (!hrefLabelIndex) {
    hrefLabelIndex = buildHrefLabelIndex();
  }
  return hrefLabelIndex;
}

function settingsTitleFromPath(path: string): string | null {
  const match = path.match(/\/settings\/transactions\/([^/]+)$/);
  if (!match) return null;
  return contextFromSettingsSlug(match[1])?.title ?? null;
}

function looksLikeAppPath(value: string): boolean {
  return value.includes('/') || value.startsWith('http');
}

function matchByPrefix(path: string, index: Map<string, string>): string | null {
  const parts = path.split('/').filter(Boolean);
  for (let len = parts.length; len >= 1; len -= 1) {
    const candidate = `/${parts.slice(0, len).join('/')}`;
    const label = index.get(candidate);
    if (label) {
      if (candidate === path) return label;
      if (len < parts.length) {
        return `${label} — تفاصيل`;
      }
      return label;
    }
  }
  return null;
}

export function resolveTabLabel(pathname: string | null | undefined): string {
  if (!pathname) return 'الرئيسية';
  const path = normalizePath(pathname);
  const index = getHrefLabelIndex();

  const settingsTitle = settingsTitleFromPath(path);
  if (settingsTitle) return settingsTitle;

  const exact = index.get(path) ?? PATH_LABEL_EXACT[path];
  if (exact && !looksLikeAppPath(exact)) return exact;

  const prefixLabel = matchByPrefix(path, index);
  if (prefixLabel && !looksLikeAppPath(prefixLabel)) return prefixLabel;

  const lastSegment = path.split('/').filter(Boolean).pop() ?? '';
  if (SEGMENT_LABELS[lastSegment]) {
    return SEGMENT_LABELS[lastSegment];
  }

  if (/^[0-9a-f-]{8,}$/i.test(lastSegment)) {
    const parentParts = path.split('/').filter(Boolean).slice(0, -1);
    const parentPath = `/${parentParts.join('/')}`;
    const parentSettings = settingsTitleFromPath(parentPath);
    if (parentSettings) return `${parentSettings} — تفاصيل`;
    const parentLabel = index.get(parentPath) ?? PATH_LABEL_EXACT[parentPath];
    if (parentLabel && !looksLikeAppPath(parentLabel)) return `${parentLabel} — تفاصيل`;
  }

  return 'صفحة داخل النظام';
}
