import type { ModuleTourPlan, TourStep } from './academy.types';

function steps(rows: Omit<TourStep, 'stepNumber'>[]): TourStep[] {
  return rows.map((row, index) => ({ ...row, stepNumber: index + 1 }));
}

/** Instant, constitution-grounded missions. No LLM latency. */
export const ACADEMY_BLUEPRINTS: Record<string, ModuleTourPlan> = {
  'sales-invoice': {
    moduleSlug: 'sales-invoice',
    titleAr: 'فاتورة المبيعات — الكاشير ومحاسب المبيعات',
    estimatedSeconds: 90,
    source: 'blueprint',
    steps: steps([
      {
        targetSelector: "[data-tour='document-header']",
        titleAr: 'بيان نوع الحركة ونمط الفاتورة',
        descriptionAr:
          'ابدأ من ترويسة المستند: حدّد نوع الحركة ونمط الفاتورة (أنماط المستندات). النمط يثبّت المسلسل والمخزن الافتراضي ويُظهر أو يُخفي أعمدة مثل المقاسات.',
        expectedAction: 'CLICK',
      },
      {
        targetSelector: "[data-tour='source-reference']",
        titleAr: 'استدعاء عرض سعر سابق',
        descriptionAr:
          'استخدم مرجع المصدر (القسم والرقم) لاستدعاء عرض أسعار سابق. النظام يملأ العميل والأصناف تلقائياً فلا تعيد الكتابة يدوياً. إن لم يوجد عرض، أكمل الإدخال من الشبكة مباشرة.',
        expectedAction: 'CLICK',
        simulatedValue: 'عرض سعر',
      },
      {
        targetSelector: "[data-tour='items-grid']",
        titleAr: 'شبكة البنود وحراسات البيع',
        descriptionAr:
          'أدخل الأصناف والكميات هنا. حراسات الدستور: منع البيع بأقل من التكلفة، منع الرصيد السالب بالمخزن، والخصومات المتسلسلة (كل خصم على الصافي بعد السابق). الجرد المستمر يولّد قيداً رباعياً تلقائياً بعد الترحيل.',
        expectedAction: 'TYPE',
        simulatedValue: '1',
      },
      {
        targetSelector: "[data-tour='three-dots-menu']",
        titleAr: 'قائمة الإجراءات السريعة',
        descriptionAr:
          'قائمة الثلاث نقاط (...) في كل شاشات الحركات: تعديل، ترحيل، إلغاء الترحيل، طباعة، إلغاء، تكرار. زر «السابق» للعرض فقط — التعديل لا يُتاح إلا من هذه القائمة. لا يُحفظ في الدفاتر قبل الترحيل أو اعتماد بطاقة الإجراء.',
        expectedAction: 'CLICK',
      },
    ]),
  },

  'cheque-endorsement': {
    moduleSlug: 'cheque-endorsement',
    titleAr: 'تظهير شيك وارد لسداد مورد',
    estimatedSeconds: 75,
    source: 'blueprint',
    steps: steps([
      {
        targetSelector: "[data-tour='incoming-cheques-table']",
        titleAr: 'محفظة أوراق القبض',
        descriptionAr:
          'اختر شيكاً وارداً موجوداً في محفظة أوراق القبض بالخزينة. هذا مسار التظهير — تحويل ملكية شيك عميل إلى المورد، وليس تحرير شيك جديد من دفتر الشركة (أوراق الدفع عبر سند الصرف).',
        expectedAction: 'CLICK',
      },
      {
        targetSelector: "[data-tour='endorse-button']",
        titleAr: 'زر التظهير',
        descriptionAr:
          'اضغط «تظهير». القيد المحاسبي حسب الدستور: من حـ/ المورد (مدين) إلى حـ/ أوراق القبض برِّسم التحصيل (دائن). الورقة تنتقل للمورد ليُحصّلها من بنك العميل الأصلي.',
        expectedAction: 'CLICK',
      },
      {
        targetSelector: "[data-tour='supplier-select']",
        titleAr: 'اختيار المورد وأثر البنك',
        descriptionAr:
          'اختر المورد المراد سداد فاتورته أو مديونيته. رصيد حساب البنك الخاص بشركتكم لا يتأثر بربع جنيه؛ لأن المورد سيُحصّل القيمة من بنك العميل. إن أردت شيكاً مسحوباً من بنك الشركة فذلك مسار [سندات الصرف] وليس التظهير.',
        expectedAction: 'CLICK',
      },
    ]),
  },

  'purchase-landed-cost': {
    moduleSlug: 'purchase-landed-cost',
    titleAr: 'فاتورة المشتريات والتكلفة الفعلية',
    estimatedSeconds: 95,
    source: 'blueprint',
    steps: steps([
      {
        targetSelector: "[data-tour='document-header']",
        titleAr: 'ترويسة فاتورة المشتريات',
        descriptionAr:
          'حدّد المورد والمخزن ونمط فاتورة المشتريات. الفاتورة النهائية هي شاشة التكلفة الفعلية — ليست أمر الشراء. راجع الدستور: إضافات الشحن والجمارك تُوزَّع لاحقاً على الأصناف.',
        expectedAction: 'CLICK',
      },
      {
        targetSelector: "[data-tour='items-grid']",
        titleAr: 'بنود الشراء',
        descriptionAr:
          'أدخل الأصناف والكميات وأسعار المورد. بعد توزيع الإضافات ينتج «سعر الصنف الفعلي شامل المصاريف» (Landed Unit Cost) ويحدّث متوسط التكلفة المرجح في المخزن تلقائياً.',
        expectedAction: 'TYPE',
        simulatedValue: '1',
      },
      {
        targetSelector: "[data-tour='landed-cost-extras']",
        titleAr: 'إضافات وخصومات الفاتورة',
        descriptionAr:
          'سجّل مصاريف الشحن والجمارك والتفريغ هنا. تُوزَّع تلقائياً بنسبة القيمة الإجمالية لكل صنف. هذا هو مسار التكلفة الفعلية في الدستور — لا تُدخل هذه المصاريف كأصناف مخزنية منفصلة.',
        expectedAction: 'CLICK',
      },
      {
        targetSelector: "[data-tour='wht-section']",
        titleAr: 'خصم المنبع ونموذج 41',
        descriptionAr:
          'ضريبة خصم المنبع تُستقطع لصالح مصلحة الضرائب وتُنشئ تلقائياً إشعار خصم وتحصيل ضريبي (نموذج 41) من شاشة [إشعارات خصم المنبع]. راجع المبلغ قبل الترحيل.',
        expectedAction: 'INFO_NEXT',
      },
    ]),
  },
};

const ROUTE_TO_SLUG: Array<{ test: RegExp; slug: string }> = [
  { test: /sales-invoice|\/sales\/invoices/i, slug: 'sales-invoice' },
  { test: /securities\/reciept|cheques\/incoming|cheque-endors/i, slug: 'cheque-endorsement' },
  { test: /final-purchase-invoice|purchases\/invoices|landed-cost/i, slug: 'purchase-landed-cost' },
];

export function resolveModuleSlug(input: { moduleSlug?: string; currentPath?: string; role?: string }): string {
  const explicit = input.moduleSlug?.trim();
  if (explicit) {
    if (ACADEMY_BLUEPRINTS[explicit]) return explicit;
    return explicit;
  }
  const path = input.currentPath ?? '';
  const fromRoute = ROUTE_TO_SLUG.find((row) => row.test.test(path));
  if (fromRoute) return fromRoute.slug;
  if (/cashier|كاشير|sales|مبيعات/i.test(input.role ?? '')) return 'sales-invoice';
  if (/account|محاسب|financial|مالية/i.test(input.role ?? '')) return 'cheque-endorsement';
  return 'sales-invoice';
}

export function getBlueprint(moduleSlug: string): ModuleTourPlan | undefined {
  const plan = ACADEMY_BLUEPRINTS[moduleSlug];
  return plan ? { ...plan, steps: plan.steps.map((step) => ({ ...step })) } : undefined;
}
