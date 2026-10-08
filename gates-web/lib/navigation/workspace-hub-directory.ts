import { isRouteUnavailable } from '@/lib/navigation/route-visibility';

/** Quick navigation matrix for the workspace hub (no module sidebar active). */

export type WorkspaceHubLink = {
  label: string;
  href: string;
};

export type WorkspaceHubGroup = {
  id: string;
  title: string;
  links: WorkspaceHubLink[];
};

const WORKSPACE_HUB_GROUPS_RAW: WorkspaceHubGroup[] = [
  {
    id: 'automation',
    title: 'Gates Agent',
    links: [
      { label: 'Gates Agent', href: '/automation' },
      { label: 'إنشاء أتمتة جديدة', href: '/automation/new' },
    ],
  },
  {
    id: 'growth',
    title: 'النمو والأثر',
    links: [
      { label: 'محرك النمو', href: '/growth' },
      { label: 'أثر Gates', href: '/growth/impact' },
    ],
  },
  {
    id: 'sales',
    title: 'المبيعات والعملاء',
    links: [
      { label: 'فواتير البيع', href: '/inventory/operations/sales-invoice' },
      { label: 'تتبع أقساط الفواتير', href: '/inventory/operations/invoice-installments' },
      { label: 'عروض الأسعار', href: '/inventory/operations/price-quote' },
      { label: 'أوامر البيع', href: '/inventory/operations/sales-order' },
      { label: 'أمر توريد', href: '/inventory/operations/supply-order' },
      { label: 'متابعة أوامر التوريد', href: '/inventory/reports/supply-order-follow-up' },
      { label: 'دليل العملاء والموردين', href: '/accounting/guide/customers-suppliers' },
      { label: 'مرتجعات المبيعات', href: '/inventory/operations/sales-returns' },
    ],
  },
  {
    id: 'inventory',
    title: 'المخازن والأصناف',
    links: [
      { label: 'دليل المخازن', href: '/inventory/guide' },
      { label: 'دليل الأصناف', href: '/inventory/guide/items' },
      { label: 'إذن إضافة مخزني', href: '/inventory/operations/receipt' },
      { label: 'إذن صرف مخزني', href: '/inventory/operations/issue' },
      { label: 'التحويلات المخزنية', href: '/inventory/operations/transfer' },
      { label: 'تسوية الجرد المخزني', href: '/inventory/operations/stocktaking' },
    ],
  },
  {
    id: 'accounting',
    title: 'الحسابات العامة',
    links: [
      { label: 'شجرة الحسابات', href: '/accounting/chart-of-accounts' },
      { label: 'قيود اليومية', href: '/accounting/operations/journal-entry' },
      { label: 'دليل المندوبين والتوزيع', href: '/accounting/guide/representatives-guide' },
      { label: 'كشوف الحسابات', href: '/accounting/account-reports/credit/account-balances' },
    ],
  },
  {
    id: 'contracting',
    title: 'المقاولات والمستخلصات',
    links: [
      { label: 'لوحة المقاولات', href: '/contracting' },
      { label: 'العطاءات', href: '/contracting/tenders' },
      { label: 'المشاريع', href: '/contracting/projects' },
      { label: 'تقارير المقاولات', href: '/contracting/reports' },
      { label: 'مقاولو الباطن', href: '/subcontracts/contracts' },
      { label: 'أرشيف Wave3', href: '/contracting/extracts' },
      { label: 'مستخلصات قديمة', href: '/extracts/operations/projects' },
    ],
  },
  {
    id: 'real-estate',
    title: 'التطوير العقاري',
    links: [
      { label: 'لوحة الاستثمار العقاري', href: '/real-estate-investment' },
      { label: 'لوحة المحفظة العقارية', href: '/real-estate' },
      { label: 'عقود الوحدات', href: '/real-estate/contracts' },
      { label: 'محفظة الشيكات', href: '/real-estate/cheques' },
      { label: 'إعادة البيع والتنازل', href: '/real-estate/resale' },
    ],
  },
  {
    id: 'eta',
    title: 'الفاتورة الإلكترونية',
    links: [
      { label: 'لوحة الفواتير الإلكترونية', href: '/electronic-invoices' },
      { label: 'إرسال فاتورة ETA', href: '/electronic-invoices/creations/send-invoice' },
      { label: 'إعدادات التوقيع', href: '/electronic-invoices/settings' },
    ],
  },
  {
    id: 'hr',
    title: 'الموارد البشرية والرواتب',
    links: [
      { label: 'بيانات الموظفين', href: '/hr/employee-data' },
      { label: 'مسيرات الرواتب', href: '/hr/monthly-salaries' },
      { label: 'السلف والعهد', href: '/hr/employee-advance' },
    ],
  },
];

export const WORKSPACE_HUB_GROUPS: WorkspaceHubGroup[] = WORKSPACE_HUB_GROUPS_RAW.map((group) => ({
  ...group,
  links: group.links.filter((link) => !isRouteUnavailable(link.href)),
})).filter((group) => group.links.length > 0);
