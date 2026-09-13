/**
 * @deprecated Legacy rich-step / video-era academy content.
 * Replaced by Gates Academy AI Copilot (`/api/v1/ai/academy`).
 */
import type { DriveStep } from 'driver.js';
import type { AcademyProgramId, AcademyStepMeta } from '@/lib/onboarding/academyTours';

export type TourModuleSlug =
  | 'sales-tour'
  | 'inventory-tour'
  | 'extracts-tour'
  | 'dashboard-tour';

/** The 4 legacy programs that use the "rich step" content pipeline below (additive 12 programs use academyToursExtended.ts instead). */
type LegacyRichProgramId =
  | 'sales-cycle'
  | 'inventory-mastery'
  | 'contracting-extracts'
  | 'executive-dashboard';

export const TOUR_SLUG_BY_PROGRAM: Record<LegacyRichProgramId, TourModuleSlug> = {
  'sales-cycle': 'sales-tour',
  'inventory-mastery': 'inventory-tour',
  'contracting-extracts': 'extracts-tour',
  'executive-dashboard': 'dashboard-tour',
};

export type AcademyModuleCardData = {
  programId: AcademyProgramId;
  slug: TourModuleSlug | 'foundation-8' | string;
  emoji: string;
  iconBgClass: string;
  title: string;
  durationLabel: string;
  levelLabel: string;
  stationCount: number;
  overview: string;
  takeaways: string[];
  /** Additive: surfaces the sandbox-mode badge on cards whose final step performs a real mutation. */
  sandboxRecommended?: boolean;
};

export type RichTourStep = {
  id: string;
  route: string;
  selector: string;
  stationTitle: string;
  title: string;
  description: string;
  side?: 'top' | 'bottom' | 'left' | 'right';
  align?: 'start' | 'center' | 'end';
};

export function richStepsToDrive(steps: RichTourStep[]): DriveStep[] {
  return steps.map((s) => ({
    element: s.selector,
    popover: {
      title: s.title,
      description: s.description,
      side: s.side ?? 'bottom',
      align: s.align ?? 'center',
    },
  }));
}

export function richStepsToMeta(steps: RichTourStep[]): AcademyStepMeta[] {
  return steps.map((s) => ({
    id: s.id,
    route: s.route,
    stationTitle: s.stationTitle,
  }));
}

const SALES_STEPS: RichTourStep[] = [
  {
    id: 'sales-customer',
    route: '/inventory/operations/sales-invoice',
    selector: '[data-tour="invoice-customer-select"]',
    stationTitle: 'المحطة 1: العميل وفئة السعر',
    title: 'تحديد العميل وسقف الائتمان',
    description:
      'ابدأ باختيار العميل من القائمة أو أضفه سريعاً (JIT). راجع فئة السعر وسقف الائتمان قبل إدخال الأصناف — هذا يضبط التسعير والتحصيل تلقائياً.',
    side: 'bottom',
    align: 'start',
  },
  {
    id: 'sales-grid',
    route: '/inventory/operations/sales-invoice',
    selector: '[data-tour="invoice-items-grid"]',
    stationTitle: 'المحطة 2: جدول الأصناف',
    title: 'إدخال الأصناف وهامش الربح',
    description:
      'استخدم Tab و Enter للإدخال السريع، والصق من Excel عند الحاجة. راقب التكلفة اللحظية والهامش قبل الترحيل لتفادي البيع بخسارة.',
    side: 'top',
    align: 'center',
  },
  {
    id: 'sales-tender',
    route: '/inventory/operations/sales-invoice',
    selector: '[data-tour="multi-tender-btn"]',
    stationTitle: 'المحطة 3: طرق الدفع',
    title: 'تجزئة الدفع (كاش / بنك / آجل)',
    description:
      'اختر نقدي أو آجل أو «دفع متعدد» لتوزيع المبلغ على أكثر من طريقة. هذا يربط الفاتورة بالخزينة والبنوك فور الترحيل.',
    side: 'bottom',
    align: 'center',
  },
  {
    id: 'sales-tafqeet',
    route: '/inventory/operations/sales-invoice',
    selector: '[data-tour="tafqeet-indicator"]',
    stationTitle: 'المحطة 4: التفقيط المالي',
    title: 'مراجعة المبلغ كتابةً',
    description:
      'تحقق من التفقيط العربي للصافي المستحق — خطوة سريعة تمنع أخطاء التحصيل والشيكات والطباعة الرسمية.',
    side: 'top',
    align: 'center',
  },
  {
    id: 'sales-save',
    route: '/inventory/operations/sales-invoice',
    selector: '[data-tour="invoice-save-print"]',
    stationTitle: 'المحطة 5: الاعتماد والطباعة',
    title: 'حفظ، ترحيل، وطباعة',
    description:
      'احفظ المسودة ثم «ترحيل الفاتورة» لتوليد القيد والأثر المخزني. بعدها اطبع من مركز الطباعة داخل النظام.',
    side: 'bottom',
    align: 'end',
  },
];

const INVENTORY_STEPS: RichTourStep[] = [
  {
    id: 'inv-search',
    route: '/inventory/guide/items',
    selector: '[data-tour="item-search-card"]',
    stationTitle: 'المحطة 1: دليل الأصناف',
    title: 'البحث الفوري في الأصناف والأرصدة',
    description:
      'من دليل الأصناف ابحث بالاسم أو الباركود ثم افتح بطاقة الصنف لرؤية الوحدات والأسعار والحركة.',
    side: 'bottom',
    align: 'start',
  },
  {
    id: 'inv-movements',
    route: '/inventory/operations/issue',
    selector: '[data-tour="stock-movement-types"]',
    stationTitle: 'المحطة 2: حركات المخزون',
    title: 'الصرف والإضافة والتحويل',
    description:
      'ميّز بين إذن الصرف وإذن الإضافة والتحويل بين المخازن — كل حركة تولّد أثراً مخزنياً ومحاسبياً عند الاعتماد.',
    side: 'top',
    align: 'center',
  },
  {
    id: 'inv-matrix',
    route: '/inventory/creations/item-card',
    selector: '[data-tour="warehouse-stock-matrix"]',
    stationTitle: 'المحطة 3: توزيع المخزون',
    title: 'الأرصدة عبر المخازن والفروع',
    description:
      'تابع توزيع الكميات بين المخازن لمعرفة أين يتوفر الصنف قبل البيع أو النقل.',
    side: 'top',
    align: 'center',
  },
  {
    id: 'inv-reorder',
    route: '/inventory/creations/item-card',
    selector: '[data-tour="reorder-level-alert"]',
    stationTitle: 'المحطة 4: حد إعادة الطلب',
    title: 'ضبط ومتابعة النواقص',
    description:
      'حدّد حد إعادة الطلب والنسبة التحذيرية ليُنبهك النظام قبل نفاد الصنف في المبيعات أو التصنيع.',
    side: 'top',
    align: 'start',
  },
];

const EXTRACTS_STEPS: RichTourStep[] = [
  {
    id: 'ext-project',
    route: '/extracts/operations/projects/make-extract',
    selector: '[data-tour="contracting-project-select"]',
    stationTitle: 'المحطة 1: المشروع والتحمل',
    title: 'اختيار المشروع ونسب التأمين',
    description:
      'اربط المستخلص بالمشروع الصحيح وراجع إعدادات التحميل والتأمينات قبل إدخال بنود الإنجاز.',
    side: 'bottom',
    align: 'start',
  },
  {
    id: 'ext-boq',
    route: '/extracts/operations/projects/make-extract',
    selector: '[data-tour="extract-boq-table"]',
    stationTitle: 'المحطة 2: بنود المقايسة',
    title: 'كميات الإنجاز ونسب الإنجاز',
    description:
      'أدخل الكميات السابقة والحالية لكل بند — النظام يحسب نسب الإنجاز وقيمة المستخلص تلقائياً.',
    side: 'top',
    align: 'center',
  },
  {
    id: 'ext-deductions',
    route: '/extracts/operations/projects/make-extract',
    selector: '[data-tour="extract-deductions-panel"]',
    stationTitle: 'المحطة 3: الاستقطاعات',
    title: 'الدفعة المقدمة وغرامات التأخير',
    description:
      'راجع استقطاع الدفعة المقدمة وغرامات التأخير والدمغات — هذه تؤثر مباشرة على صافي المستحق للمقاول.',
    side: 'bottom',
    align: 'center',
  },
  {
    id: 'ext-post',
    route: '/extracts/operations/projects/make-extract',
    selector: '[data-tour="extract-post-btn"]',
    stationTitle: 'المحطة 4: اعتماد المستخلص',
    title: 'ترحيل الاستحقاق',
    description:
      'بعد المراجعة اعتمد المستخلص لتوليد استحقاق مقاول الباطن والقيد المحاسبي المرتبط.',
    side: 'bottom',
    align: 'end',
  },
];

const DASHBOARD_STEPS: RichTourStep[] = [
  {
    id: 'dash-profit',
    route: '/dashboard',
    selector: '[data-tour="kpi-net-profit"]',
    stationTitle: 'المحطة 1: صافي الأرباح',
    title: 'قراءة الربحية والنمو',
    description:
      'تابع صافي الربح/الخسارة ومبيعات الشهر من بيانات مرحّلة — مؤشرات حية للإدارة اليومية.',
    side: 'top',
    align: 'center',
  },
  {
    id: 'dash-treasury',
    route: '/dashboard',
    selector: '[data-tour="treasury-balances"]',
    stationTitle: 'المحطة 2: السيولة',
    title: 'خزائن وبنوك لحظياً',
    description:
      'راقب السيولة النقدية والبنكية قبل قرارات الصرف أو التحصيل — الرقم يتحدث مع كل حركة خزينة.',
    side: 'top',
    align: 'center',
  },
  {
    id: 'dash-stealth',
    route: '/dashboard',
    selector: '[data-tour="privacy-eye"]',
    stationTitle: 'المحطة 3: وضع السرية',
    title: 'إخفاء الأرقام أمام الزوار',
    description:
      'فعّل وضع الخصوصية من أيقونة العين أو `Cmd + Shift + H` لإخفاء الأرباح والسيولة فوراً.',
    side: 'bottom',
    align: 'end',
  },
  {
    id: 'dash-digest',
    route: '/dashboard',
    selector: '[data-tour="sentinel-radar-btn"]',
    stationTitle: 'المحطة 4: رادار الرقابة',
    title: 'رادار الرقابة والمخاطر',
    description:
      'افتح تقرير الرقابة الداخلية ودرع السيولة من داخل النظام — الشبهات، تكلفة الإحلال، وفجوات المقاولات.',
    side: 'left',
    align: 'start',
  },
];

export const RICH_TOUR_STEPS_BY_PROGRAM: Record<LegacyRichProgramId, RichTourStep[]> = {
  'sales-cycle': SALES_STEPS,
  'inventory-mastery': INVENTORY_STEPS,
  'contracting-extracts': EXTRACTS_STEPS,
  'executive-dashboard': DASHBOARD_STEPS,
};

export const ACADEMY_MODULE_CARDS: AcademyModuleCardData[] = [
  {
    programId: 'foundation-8',
    slug: 'foundation-8',
    emoji: '⚡',
    iconBgClass: 'bg-sky-100 text-sky-700',
    title: 'الجولة التأسيسية الشاملة (8 محطات)',
    durationLabel: '8 دقائق',
    levelLabel: 'مبتدئ',
    stationCount: 8,
    overview:
      'رحلة سريعة عبر البحث، الموديولات، شجرة الحسابات، فاتورة المبيعات، الخصوصية، ورادار الأمان.',
    takeaways: [
      'Cmd + K للبحث والمفضلة',
      'إدخال فاتورة بالكيبورد و JIT للعملاء',
      'خصوصية المدير ورادار تسريبات الربح',
    ],
  },
  {
    programId: 'sales-cycle',
    slug: 'sales-tour',
    emoji: '🧾',
    iconBgClass: 'bg-emerald-100 text-emerald-700',
    title: 'دورة المبيعات والفاتورة الإلكترونية',
    durationLabel: '5 دقائق',
    levelLabel: 'مبتدئ',
    stationCount: 5,
    overview:
      'من اختيار العميل حتى ترحيل الفاتورة والطباعة — دورة مبيعات كاملة على شاشة واحدة.',
    takeaways: [
      'إنشاء فاتورة ضريبية وربط الخزينة وطرق الدفع',
      'تجزئة الدفع (كاش / بنك / آجل) والتفقيط',
      'طباعة وترحيل الفاتورة من داخل النظام',
    ],
  },
  {
    programId: 'inventory-mastery',
    slug: 'inventory-tour',
    emoji: '📦',
    iconBgClass: 'bg-amber-100 text-amber-800',
    title: 'إدارة المخازن والأصناف',
    durationLabel: '4 دقائق',
    levelLabel: 'مبتدئ',
    stationCount: 4,
    overview: 'تحكم في الأرصدة، الحركات، والنواقص قبل أن تؤثر على المبيعات والتكلفة.',
    takeaways: [
      'بحث سريع في كروت الأصناف والباركود',
      'تمييز الصرف والإضافة والتحويلات',
      'متابعة حد إعادة الطلب والنواقص',
    ],
  },
  {
    programId: 'contracting-extracts',
    slug: 'extracts-tour',
    emoji: '🏗️',
    iconBgClass: 'bg-violet-100 text-violet-700',
    title: 'المقاولات وبنود المقايسة',
    durationLabel: '4 دقائق',
    levelLabel: 'احترافي',
    stationCount: 4,
    overview: 'من المقايسة إلى مستخلص مقاول الباطن مع الاستقطاعات والاعتماد المحاسبي.',
    takeaways: [
      'ربط المشروع ونسب التحميل والتأمين',
      'إدخال كميات الإنجاز ونسب الإنجاز',
      'استقطاعات الدفعة المقدمة واعتماد المستخلص',
    ],
  },
  {
    programId: 'executive-dashboard',
    slug: 'dashboard-tour',
    emoji: '📊',
    iconBgClass: 'bg-cyan-100 text-cyan-800',
    title: 'الداشبورد والرقابة التنفيذية',
    durationLabel: '3 دقائق',
    levelLabel: 'احترافي',
    stationCount: 4,
    overview: 'قراءة الربحية والسيولة وتقرير الرقابة — لوحة المدير في دقائق.',
    takeaways: [
      'صافي الأرباح ومؤشرات النمو اليومية',
      'رصد الخزائن والبنوك والسيولة',
      'وضع السرية ورادار الرقابة داخل النظام',
    ],
  },
];

export function getModuleCard(programId: AcademyProgramId): AcademyModuleCardData | undefined {
  return ACADEMY_MODULE_CARDS.find((c) => c.programId === programId);
}

/** @deprecated alias for tourConfig consumers */
export const toursData = {
  modules: ACADEMY_MODULE_CARDS,
  stepsByProgram: RICH_TOUR_STEPS_BY_PROGRAM,
};
