export type ContractingReportConfig = {
  titleAr: string;
  apiPath: string | ((params: Record<string, string>) => string);
  needsProject?: boolean;
  needsCustomer?: boolean;
  needsSubcontractor?: boolean;
  dateRange?: boolean;
  legacyNote?: string;
};

export const CONTRACTING_REPORT_CONFIG: Record<string, ContractingReportConfig> = {
  'management-dashboard': {
    titleAr: 'لوحة إدارة المقاولات',
    apiPath: '/contracting/reports/management-dashboard',
  },
  'project-master': {
    titleAr: 'ملخص المشروعات',
    apiPath: '/contracting/reports/project-master',
  },
  'project-financial-position': {
    titleAr: 'الموقف المالي للمشروع',
    apiPath: (p) => `/contracting/reports/project-financial-position/${p.projectId}`,
    needsProject: true,
  },
  'project-profitability': {
    titleAr: 'ربحية المشروعات',
    apiPath: '/contracting/reports/project-profitability',
  },
  'boq-profitability': {
    titleAr: 'ربحية بنود الأعمال',
    apiPath: (p) => `/contracting/reports/boq-profitability/${p.projectId}`,
    needsProject: true,
  },
  'budget-vs-actual-committed': {
    titleAr: 'المخطط مقابل الفعلي والالتزامات',
    apiPath: (p) => `/contracting/reports/budget-vs-actual-committed/${p.projectId}`,
    needsProject: true,
  },
  'project-cost-detail': {
    titleAr: 'تفاصيل تكاليف المشروع',
    apiPath: (p) => `/contracting/reports/project-cost-detail/${p.projectId}`,
    needsProject: true,
    dateRange: true,
  },
  'unallocated-cost': { titleAr: 'تكاليف غير موزعة', apiPath: '/contracting/reports/unallocated-cost' },
  'cost-by-category': { titleAr: 'تكلفة حسب النوع', apiPath: '/contracting/reports/cost-by-category' },
  'material-cost': { titleAr: 'تكلفة المواد', apiPath: '/contracting/reports/material-cost', dateRange: true },
  'contract-value-vo': { titleAr: 'قيمة العقود وأوامر التغيير', apiPath: '/contracting/reports/contract-value-vo' },
  'owner-certificates': {
    titleAr: 'مستخلصات العملاء',
    apiPath: '/contracting/reports/owner-certificates',
    dateRange: true,
  },
  'owner-certificate-summary': {
    titleAr: 'ملخص مستخلصات العملاء',
    apiPath: '/contracting/reports/owner-certificate-summary',
  },
  collections: { titleAr: 'تحصيلات المشروعات', apiPath: '/contracting/reports/collections', dateRange: true },
  'customer-statement': {
    titleAr: 'كشف حساب عميل',
    apiPath: (p) => `/contracting/reports/customer-statement/${p.customerId}`,
    needsCustomer: true,
    dateRange: true,
  },
  'subcontractor-position': {
    titleAr: 'موقف مقاولي الباطن',
    apiPath: '/contracting/reports/subcontractor-position',
  },
  'subcontractor-certificates': {
    titleAr: 'مستخلصات مقاولي الباطن',
    apiPath: '/contracting/reports/subcontractor-certificates',
    dateRange: true,
  },
  'subcontractor-statement': {
    titleAr: 'كشف حساب مقاول باطن',
    apiPath: (p) => `/contracting/reports/subcontractor-statement/${p.subcontractorId}`,
    needsSubcontractor: true,
    dateRange: true,
  },
  'subcontract-commitment': {
    titleAr: 'التزامات مقاولي الباطن',
    apiPath: '/contracting/reports/subcontract-commitment',
  },
  'execution-progress': { titleAr: 'موقف تنفيذ المشروعات', apiPath: '/contracting/reports/execution-progress' },
  'activity-performance': {
    titleAr: 'أداء أنشطة التنفيذ',
    apiPath: (p) => `/contracting/reports/activity-performance/${p.projectId}`,
    needsProject: true,
  },
  'delayed-projects': { titleAr: 'المشروعات المتأخرة', apiPath: '/contracting/reports/delayed-projects' },
  'cost-overrun': { titleAr: 'المشروعات المتجاوزة للتكلفة', apiPath: '/contracting/reports/cost-overrun' },
  'forecast-completion': {
    titleAr: 'التوقعات حتى الإتمام',
    apiPath: '/contracting/reports/forecast-completion',
  },
  'tender-pipeline': { titleAr: 'موقف العطاءات', apiPath: '/contracting/reports/tender-pipeline' },
  'tender-win-loss': { titleAr: 'تحليل العطاءات والترسيات', apiPath: '/contracting/reports/tender-win-loss', dateRange: true },
  'tender-estimate-vs-actual': {
    titleAr: 'دراسة العطاء مقابل الفعلي',
    apiPath: '/contracting/reports/tender-estimate-vs-actual',
  },
  'margin-erosion': { titleAr: 'تآكل هامش الربح', apiPath: '/contracting/reports/margin-erosion' },
  'cash-vs-profit': { titleAr: 'التحصيل مقابل الربحية', apiPath: '/contracting/reports/cash-vs-profit' },
};
