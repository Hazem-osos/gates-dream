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

export const WORKSPACE_HUB_GROUPS: WorkspaceHubGroup[] = [
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
      { label: 'دليل العملاء والموردين', href: '/accounting/guide/customers-suppliers' },
      { label: 'مرتجعات المبيعات', href: '/inventory/operations/sales-returns' },
    ],
  },
  {
    id: 'inventory',
    title: 'المخازن والأصناف',
    links: [
      { label: 'دليل الأصناف', href: '/inventory/guide/items' },
      { label: 'بطاقة الصنف', href: '/inventory/creations/item-card' },
      { label: 'أذون الإضافة', href: '/inventory/operations/receipt' },
      { label: 'أذون الصرف', href: '/inventory/operations/issue' },
      { label: 'التحويلات المخزنية', href: '/inventory/operations/transfer' },
      { label: 'الجرد المخزني', href: '/inventory/operations/stocktaking' },
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
      { label: 'مساحة المشروع التنفيذية', href: '/contracting/projects' },
      { label: 'المشاريع والمستخلصات', href: '/contracting/extracts' },
      { label: 'لوحة مقاولي الباطن', href: '/subcontracts' },
      { label: 'سجل عقود الباطن', href: '/subcontracts/contracts' },
      { label: 'مقايسات الأعمال', href: '/contracting/extracts' },
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
      { label: 'السلف والعهد', href: '/hr/transaction-tracking' },
    ],
  },
];
