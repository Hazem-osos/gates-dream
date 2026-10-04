export type ContractingReportGroupId =
  | 'management'
  | 'contracts'
  | 'certificates'
  | 'cost_profit'
  | 'subcontractors'
  | 'execution'
  | 'tenders'
  | 'financial';

export type ContractingReportCatalogEntry = {
  key: string;
  nameAr: string;
  descriptionAr: string;
  groupId: ContractingReportGroupId;
  legacy?: boolean;
  filters: Array<'projectId' | 'customerId' | 'subcontractorId' | 'dateFrom' | 'dateTo' | 'tenderStatus'>;
};

export const CONTRACTING_REPORT_GROUPS: Record<
  ContractingReportGroupId,
  { titleAr: string; descriptionAr: string }
> = {
  management: { titleAr: 'لوحة الإدارة', descriptionAr: 'مؤشرات المحفظة والإدارة العليا' },
  contracts: { titleAr: 'العقود والمشروعات', descriptionAr: 'قيمة العقود وملخص المشروعات' },
  certificates: { titleAr: 'المستخلصات والعملاء', descriptionAr: 'مستخلصات المالك والتحصيل' },
  cost_profit: { titleAr: 'التكاليف والربحية', descriptionAr: 'P2/P2-2 — تكلفة وربحية وموازنة' },
  subcontractors: { titleAr: 'المقاولين', descriptionAr: 'مقاولي الباطن والالتزامات' },
  execution: { titleAr: 'التنفيذ والأداء', descriptionAr: 'P3 — جدول وتأخير وتجاوز تكلفة' },
  tenders: { titleAr: 'العطاءات', descriptionAr: 'P4 — خط الأنابيب والترسية' },
  financial: { titleAr: 'التحليل المالي', descriptionAr: 'موقف مالي وتآكل هامش ونقد مقابل ربح' },
};

export const CONTRACTING_REPORT_CATALOG: ContractingReportCatalogEntry[] = [
  {
    key: 'management-dashboard',
    nameAr: 'لوحة إدارة المقاولات',
    descriptionAr: 'محفظة المشاريع: عقود، إيراد، تكلفة، ربح متوقع، عطاءات',
    groupId: 'management',
    filters: [],
  },
  {
    key: 'project-master',
    nameAr: 'ملخص المشروعات',
    descriptionAr: 'بطاقة إدارية لكل مشروع من مصادر P1/P2/P3',
    groupId: 'contracts',
    filters: ['projectId'],
  },
  {
    key: 'project-financial-position',
    nameAr: 'الموقف المالي للمشروع',
    descriptionAr: 'ورقة إدارة شاملة لمشروع واحد',
    groupId: 'financial',
    filters: ['projectId'],
  },
  {
    key: 'contract-value-vo',
    nameAr: 'قيمة العقود وأوامر التغيير',
    descriptionAr: 'أصلي، معتمد، معلّق — أوامر التغيير فقط المعتمدة في الرسمي',
    groupId: 'contracts',
    filters: ['projectId'],
  },
  {
    key: 'project-profitability',
    nameAr: 'ربحية المشروعات',
    descriptionAr: 'EAC وهامش متوقع — بدون استخدام التحصيل كربح',
    groupId: 'cost_profit',
    filters: ['projectId'],
  },
  {
    key: 'boq-profitability',
    nameAr: 'ربحية بنود الأعمال',
    descriptionAr: 'BOQ — مخطط، فعلي، التزام، EAC، إشارات',
    groupId: 'cost_profit',
    filters: ['projectId'],
  },
  {
    key: 'budget-vs-actual-committed',
    nameAr: 'المخطط مقابل الفعلي والالتزامات',
    descriptionAr: 'على مستوى البند والفئة',
    groupId: 'cost_profit',
    filters: ['projectId'],
  },
  {
    key: 'project-cost-detail',
    nameAr: 'تفاصيل تكاليف المشروع',
    descriptionAr: 'P2-1 — ProjectCostAllocation',
    groupId: 'cost_profit',
    filters: ['projectId', 'dateFrom', 'dateTo'],
  },
  {
    key: 'unallocated-cost',
    nameAr: 'تكاليف غير موزعة على بنود',
    descriptionAr: 'تكلفة بدون projectBOQItemId',
    groupId: 'cost_profit',
    filters: ['projectId'],
  },
  {
    key: 'cost-by-category',
    nameAr: 'تكلفة المشروع حسب النوع',
    descriptionAr: 'مجاميع P2-1 حسب فئة التكلفة',
    groupId: 'cost_profit',
    filters: ['projectId'],
  },
  {
    key: 'material-cost',
    nameAr: 'تكلفة المواد على المشروعات',
    descriptionAr: 'صرف مخزني MATERIAL فقط — لا سعر بيع',
    groupId: 'cost_profit',
    filters: ['projectId', 'dateFrom', 'dateTo'],
  },
  {
    key: 'owner-certificates',
    nameAr: 'مستخلصات العملاء',
    descriptionAr: 'ClientInvoice — حالة مالية وتحصيل',
    groupId: 'certificates',
    filters: ['projectId', 'customerId', 'dateFrom', 'dateTo'],
  },
  {
    key: 'owner-certificate-summary',
    nameAr: 'ملخص مستخلصات العملاء',
    descriptionAr: 'معتمد تشغيلي/مالي ومتبقي عقد',
    groupId: 'certificates',
    filters: ['projectId'],
  },
  {
    key: 'collections',
    nameAr: 'تحصيلات المشروعات',
    descriptionAr: 'ContractingCertificateAllocation — بدون معكوس/ملغى',
    groupId: 'certificates',
    filters: ['projectId', 'dateFrom', 'dateTo'],
  },
  {
    key: 'customer-statement',
    nameAr: 'كشف حساب عميل — مقاولات',
    descriptionAr: 'P0-3 — دفتر CUSTOMER (لا تخمين مشروع)',
    groupId: 'certificates',
    filters: ['customerId', 'dateFrom', 'dateTo'],
  },
  {
    key: 'subcontractor-position',
    nameAr: 'موقف مقاولي الباطن',
    descriptionAr: 'التزام، معترف به، مدفوع، متبقي',
    groupId: 'subcontractors',
    filters: ['projectId', 'subcontractorId'],
  },
  {
    key: 'subcontractor-certificates',
    nameAr: 'مستخلصات مقاولي الباطن',
    descriptionAr: 'SubcontractInvoice — صافي ومدفوع',
    groupId: 'subcontractors',
    filters: ['projectId', 'subcontractorId', 'dateFrom', 'dateTo'],
  },
  {
    key: 'subcontractor-statement',
    nameAr: 'كشف حساب مقاول باطن',
    descriptionAr: 'P0-3 — partnerType SUBCONTRACTOR',
    groupId: 'subcontractors',
    filters: ['subcontractorId', 'dateFrom', 'dateTo'],
  },
  {
    key: 'subcontract-commitment',
    nameAr: 'التزامات مقاولي الباطن',
    descriptionAr: 'أصلي + VO + متبقي — الدفع منفصل',
    groupId: 'subcontractors',
    filters: ['projectId'],
  },
  {
    key: 'execution-progress',
    nameAr: 'موقف تنفيذ المشروعات',
    descriptionAr: 'P3 — تقدم وجدول وSPI',
    groupId: 'execution',
    filters: ['projectId'],
  },
  {
    key: 'activity-performance',
    nameAr: 'أداء أنشطة التنفيذ',
    descriptionAr: 'PV/EV/AC على مستوى النشاط',
    groupId: 'execution',
    filters: ['projectId'],
  },
  {
    key: 'delayed-projects',
    nameAr: 'المشروعات المتأخرة',
    descriptionAr: 'تأخير جدول أو SPI منخفض',
    groupId: 'execution',
    filters: [],
  },
  {
    key: 'cost-overrun',
    nameAr: 'المشروعات المتجاوزة للتكلفة',
    descriptionAr: 'CPI أو إشارات P2-2',
    groupId: 'execution',
    filters: [],
  },
  {
    key: 'forecast-completion',
    nameAr: 'التوقعات حتى إتمام المشروع',
    descriptionAr: 'EAC وطريقة التوقع وتاريخ الإنهاء',
    groupId: 'execution',
    filters: ['projectId'],
  },
  {
    key: 'tender-pipeline',
    nameAr: 'موقف العطاءات',
    descriptionAr: 'P4 — دراسة وتسعير وترسية',
    groupId: 'tenders',
    filters: ['tenderStatus', 'dateFrom', 'dateTo'],
  },
  {
    key: 'tender-win-loss',
    nameAr: 'تحليل العطاءات والترسيات',
    descriptionAr: 'معدل ترسية وقيم معروضة',
    groupId: 'tenders',
    filters: ['dateFrom', 'dateTo'],
  },
  {
    key: 'tender-estimate-vs-actual',
    nameAr: 'مقارنة دراسة العطاء بالتكلفة الفعلية',
    descriptionAr: 'للمشاريع المرسّاة فقط — lineage P4',
    groupId: 'tenders',
    filters: ['projectId'],
  },
  {
    key: 'margin-erosion',
    nameAr: 'تآكل هامش الربح',
    descriptionAr: 'هامش العطاء/الترسية مقابل المتوقع الحالي',
    groupId: 'financial',
    filters: ['projectId'],
  },
  {
    key: 'cash-vs-profit',
    nameAr: 'التحصيل مقابل الربحية',
    descriptionAr: 'التحصيل ≠ الإيراد — إدارة فقط',
    groupId: 'financial',
    filters: ['projectId'],
  },
  {
    key: 'evm-legacy',
    nameAr: 'EVM (أرشيف Wave)',
    descriptionAr: 'قديم — استخدم موقف التنفيذ P3',
    groupId: 'execution',
    legacy: true,
    filters: ['projectId'],
  },
];
