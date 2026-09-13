import type { DriveStep } from 'driver.js';
import type {
  AcademyCategory,
  AcademyProgram,
  AcademyStepMeta,
  AcademyStepTrigger,
} from '@/lib/onboarding/academyTours';

/**
 * Twelve newly authored mini-tours across the four requested job-role
 * categories (additive to the 5 existing programs in `academyTours.ts`).
 * Kept in a separate file per the plan so the diff on the original file
 * stays isolated to the `ACADEMY_PROGRAMS` merge point.
 */
export type ExtendedAcademyProgramId =
  | 'sales-first-invoice'
  | 'sales-cash-collection'
  | 'sales-return-flow'
  | 'inventory-goods-receipt'
  | 'inventory-stock-transfer'
  | 'inventory-stocktaking-flow'
  | 'accounting-journal-entry'
  | 'accounting-customer-statement'
  | 'accounting-trial-balance'
  | 'treasury-receipt-voucher'
  | 'treasury-payment-voucher'
  | 'treasury-cheque-lifecycle';

type ExtendedStep = {
  id: string;
  route: string;
  selector: string;
  stationTitle: string;
  title: string;
  description: string;
  side?: 'top' | 'bottom' | 'left' | 'right';
  align?: 'start' | 'center' | 'end';
  trigger?: AcademyStepTrigger;
};

function buildProgram(
  id: ExtendedAcademyProgramId,
  title: string,
  emoji: string,
  description: string,
  category: AcademyCategory,
  steps: ExtendedStep[],
  sandboxRecommended = false
): AcademyProgram {
  const driveSteps: DriveStep[] = steps.map((s) => ({
    element: s.selector,
    popover: {
      title: s.title,
      description: s.description,
      side: s.side ?? 'bottom',
      align: s.align ?? 'center',
    },
  }));
  const meta: AcademyStepMeta[] = steps.map((s) => ({
    id: s.id,
    route: s.route,
    stationTitle: s.stationTitle,
    trigger: s.trigger,
  }));
  return { id, title, emoji, description, category, sandboxRecommended, steps: driveSteps, meta };
}

const SALES_INVOICE_ROUTE = '/inventory/operations/sales-invoice';

const salesFirstInvoice = buildProgram(
  'sales-first-invoice',
  'إصدار أول فاتورة مبيعات',
  '🧾',
  'خطوة بخطوة: اختيار العميل، إدخال الأصناف، والحفظ والترحيل.',
  'sales-cashier',
  [
    {
      id: 'sfi-customer',
      route: SALES_INVOICE_ROUTE,
      selector: '[data-tour="invoice-customer-select"]',
      stationTitle: 'الخطوة 1: العميل',
      title: 'اختر العميل',
      description: 'ابحث عن العميل بالاسم أو الكود من هذه القائمة. سعر البيع وسقف الائتمان يتحدثان تلقائياً بعد الاختيار.',
      side: 'bottom',
      align: 'start',
    },
    {
      id: 'sfi-jit',
      route: SALES_INVOICE_ROUTE,
      selector: '#gates-tour-invoice-customer',
      stationTitle: 'الخطوة 2: إضافة سريعة (JIT)',
      title: 'العميل غير موجود؟ أضفه فوراً',
      description: 'اضغط «+ إضافة سريع» بجانب خانة العميل لإنشاء بطاقة عميل جديدة دون مغادرة الفاتورة.',
      side: 'bottom',
      align: 'center',
      trigger: { kind: 'CLICK', id: 'sales-invoice.jit-customer-click', prompt: 'جرّب فتح نافذة الإضافة السريعة للعميل، أو اضغط «التالي» للتخطي.' },
    },
    {
      id: 'sfi-grid',
      route: SALES_INVOICE_ROUTE,
      selector: '[data-tour="invoice-items-grid"]',
      stationTitle: 'الخطوة 3: الأصناف',
      title: 'أدخل أصناف الفاتورة',
      description: 'استخدم Tab و Enter للتنقل السريع بين الحقول، أو الصق جدولاً كاملاً من Excel بـ Cmd+V.',
      side: 'top',
      align: 'center',
    },
    {
      id: 'sfi-save',
      route: SALES_INVOICE_ROUTE,
      selector: '[data-tour="invoice-save-print"]',
      stationTitle: 'الخطوة 4: الحفظ والترحيل',
      title: 'احفظ ثم رحّل الفاتورة',
      description: 'اضغط «حفظ» لتسجيل المسودة، ثم «ترحيل الفاتورة» لتوليد القيد المحاسبي والأثر المخزني فوراً.',
      side: 'bottom',
      align: 'end',
      trigger: { kind: 'API_SUCCESS', id: 'sales-invoice.post-success', prompt: 'اضغط «ترحيل الفاتورة» الآن لإكمال الجولة.' },
    },
  ],
  true
);

const salesCashCollection = buildProgram(
  'sales-cash-collection',
  'تحصيل نقدي فوري عند البيع',
  '💰',
  'تجزئة الدفع بين نقدي وبنكي وآجل، والتحقق من التفقيط قبل الحفظ.',
  'sales-cashier',
  [
    {
      id: 'cc-tender',
      route: SALES_INVOICE_ROUTE,
      selector: '[data-tour="multi-tender-btn"]',
      stationTitle: 'الخطوة 1: طريقة الدفع',
      title: 'افتح «الدفع المتعدد»',
      description: 'اختر نقدي أو بنكي بالكامل، أو اضغط هنا لتوزيع المبلغ على أكثر من طريقة دفع دفعة واحدة.',
      side: 'bottom',
      align: 'center',
      trigger: { kind: 'CLICK', id: 'sales-invoice.tender-open-click', prompt: 'افتح نافذة الدفع المتعدد الآن.' },
    },
    {
      id: 'cc-tafqeet',
      route: SALES_INVOICE_ROUTE,
      selector: '[data-tour="tafqeet-indicator"]',
      stationTitle: 'الخطوة 2: التفقيط',
      title: 'راجع المبلغ كتابةً',
      description: 'تأكد من التفقيط العربي للصافي المستحق — يمنع أخطاء التحصيل والطباعة الرسمية.',
      side: 'top',
      align: 'center',
    },
    {
      id: 'cc-save',
      route: SALES_INVOICE_ROUTE,
      selector: '[data-tour="invoice-save-print"]',
      stationTitle: 'الخطوة 3: التحصيل',
      title: 'احفظ لإتمام التحصيل',
      description: 'الترحيل هنا يسجل المبلغ في الخزينة/البنك المختار فوراً ويحدّث رصيد العميل.',
      side: 'bottom',
      align: 'end',
      trigger: { kind: 'API_SUCCESS', id: 'sales-invoice.post-success', prompt: 'اضغط «ترحيل الفاتورة» لإتمام التحصيل.' },
    },
  ],
  true
);

const SALES_RETURNS_ROUTE = '/inventory/operations/sales-returns';

const salesReturnFlow = buildProgram(
  'sales-return-flow',
  'عمل مرتجع مبيعات',
  '↩️',
  'إرجاع بضاعة عميل مع ربطها بالفاتورة الأصلية وتعديل الكميات.',
  'sales-cashier',
  [
    {
      id: 'sr-header',
      route: SALES_RETURNS_ROUTE,
      selector: '[data-tour-id="sales-returns-header"]',
      stationTitle: 'الخطوة 1: العميل والفاتورة المصدر',
      title: 'اربط المردود بالفاتورة الأصلية',
      description: 'اختر العميل، وإن وُجدت اختر رقم فاتورة البيع الأصلية ليُحمَّل النظام بنودها تلقائياً.',
      side: 'bottom',
      align: 'start',
    },
    {
      id: 'sr-lines',
      route: SALES_RETURNS_ROUTE,
      selector: '[data-tour-id="sales-returns-lines"]',
      stationTitle: 'الخطوة 2: كميات الإرجاع',
      title: 'عدّل الكميات المراد إرجاعها',
      description: 'النظام يمنع إرجاع كمية أكبر من المُباع لكل سطر — عدّل الكمية والسعر عند الحاجة.',
      side: 'top',
      align: 'center',
    },
    {
      id: 'sr-post',
      route: SALES_RETURNS_ROUTE,
      selector: '[data-tour="erp-page-header"]',
      stationTitle: 'الخطوة 3: الحفظ والترحيل',
      title: 'احفظ ثم رحّل المردود',
      description: 'الترحيل يعكس الأثر المحاسبي والمخزني للبيع الأصلي بمقدار الكمية المرتجعة فقط.',
      side: 'bottom',
      align: 'end',
      trigger: { kind: 'CLICK', id: 'sales-returns.post-click', prompt: 'اضغط «ترحيل المردود» الآن.' },
    },
  ]
);

const RECEIPT_ROUTE = '/inventory/operations/receipt';

const inventoryGoodsReceipt = buildProgram(
  'inventory-goods-receipt',
  'إذن استلام (إضافة مخزنية)',
  '📥',
  'تسجيل وارد بضاعة جديد للمخزن وترحيله محاسبياً.',
  'inventory-warehouse',
  [
    {
      id: 'gr-warehouse',
      route: RECEIPT_ROUTE,
      selector: '[data-tour-id="receipt-warehouse-select"]',
      stationTitle: 'الخطوة 1: المخزن',
      title: 'اختر المخزن المستلم',
      description: 'حدد المخزن الذي ستُضاف إليه الكمية، ثم أكمل بيانات المسلسل والتاريخ.',
      side: 'bottom',
      align: 'start',
    },
    {
      id: 'gr-lines',
      route: RECEIPT_ROUTE,
      selector: '[data-tour-id="receipt-lines-card"]',
      stationTitle: 'الخطوة 2: الأصناف',
      title: 'أضف الأصناف الواردة',
      description: 'اضغط «إضافة صنف» لكل بند، وحدد الكمية وتكلفة الوحدة — هذه التكلفة تدخل في حساب متوسط تكلفة الصنف.',
      side: 'top',
      align: 'center',
    },
    {
      id: 'gr-post',
      route: RECEIPT_ROUTE,
      selector: '[data-tour="erp-page-header"]',
      stationTitle: 'الخطوة 3: الترحيل',
      title: 'احفظ ثم رحّل الإذن',
      description: 'الترحيل يزيد رصيد المخزن فوراً ويولّد القيد المحاسبي المرتبط.',
      side: 'bottom',
      align: 'end',
      trigger: { kind: 'CLICK', id: 'inventory-receipt.post-click', prompt: 'اضغط «ترحيل» لإتمام إذن الاستلام.' },
    },
  ]
);

const TRANSFER_ROUTE = '/inventory/operations/transfer';

const inventoryStockTransfer = buildProgram(
  'inventory-stock-transfer',
  'تحويل مخزني بين فرعين',
  '🔄',
  'نقل كمية من صنف بين مخزنين مع الاحتفاظ بأثر محاسبي متوازن.',
  'inventory-warehouse',
  [
    {
      id: 'st-warehouses',
      route: TRANSFER_ROUTE,
      selector: '[data-tour-id="transfer-warehouses"]',
      stationTitle: 'الخطوة 1: من وإلى',
      title: 'حدد مخزن المصدر والوجهة',
      description: 'اختر «من مخزن» و«إلى مخزن» — يجب أن يختلفا عن بعضهما لإتمام التحويل.',
      side: 'bottom',
      align: 'start',
    },
    {
      id: 'st-lines',
      route: TRANSFER_ROUTE,
      selector: '[data-tour-id="transfer-lines-card"]',
      stationTitle: 'الخطوة 2: الأصناف المنقولة',
      title: 'أضف الأصناف وكمياتها',
      description: 'حدد الصنف والكمية المطلوب نقلها — لن يسمح النظام بنقل أكثر من الرصيد المتاح.',
      side: 'top',
      align: 'center',
    },
    {
      id: 'st-post',
      route: TRANSFER_ROUTE,
      selector: '[data-tour="erp-page-header"]',
      stationTitle: 'الخطوة 3: الترحيل',
      title: 'احفظ ثم رحّل التحويل',
      description: 'الترحيل ينقل الكمية فوراً: خصم من المصدر وإضافة للوجهة، بدون تغيير في التكلفة الإجمالية.',
      side: 'bottom',
      align: 'end',
      trigger: { kind: 'CLICK', id: 'inventory-transfer.post-click', prompt: 'اضغط «ترحيل» الآن لإتمام النقل.' },
    },
  ]
);

const STOCKTAKING_ROUTE = '/inventory/operations/stocktaking';

const inventoryStocktakingFlow = buildProgram(
  'inventory-stocktaking-flow',
  'جرد الأصناف وتسوية الفروقات',
  '📊',
  'مقارنة الرصيد الدفتري بالفعلي وتسوية العجز والزيادة محاسبياً.',
  'inventory-warehouse',
  [
    {
      id: 'sk-warehouse',
      route: STOCKTAKING_ROUTE,
      selector: '[data-tour-id="stocktaking-warehouse-select"]',
      stationTitle: 'الخطوة 1: المخزن',
      title: 'اختر المخزن المطلوب جرده',
      description: 'حدد المخزن ثم النطاق (كل الأصناف أو مجموعة معينة) قبل بدء عد الكميات الفعلية.',
      side: 'bottom',
      align: 'start',
    },
    {
      id: 'sk-table',
      route: STOCKTAKING_ROUTE,
      selector: '[data-tour-id="stocktaking-items-table"]',
      stationTitle: 'الخطوة 2: القيمة الفعلية',
      title: 'سجّل القيمة الفعلية لكل صنف',
      description: 'يحسب النظام العجز أو الزيادة تلقائياً بمقارنة القيمة الدفترية بالفعلية.',
      side: 'top',
      align: 'center',
    },
    {
      id: 'sk-save',
      route: STOCKTAKING_ROUTE,
      selector: '[data-tour-id="stocktaking-save-btn"]',
      stationTitle: 'الخطوة 3: تسوية الجرد',
      title: 'احفظ لتسوية الفروقات',
      description: 'الحفظ يولّد حركة تسوية مخزنية وقيداً محاسبياً بالعجز/الزيادة المكتشفة.',
      side: 'top',
      align: 'end',
      trigger: { kind: 'API_SUCCESS', id: 'stocktaking.save-success', prompt: 'اضغط «حفظ» الآن لتسوية الجرد.' },
    },
  ],
  true
);

const JOURNAL_ENTRY_ROUTE = '/accounting/operations/journal-entry';

const accountingJournalEntry = buildProgram(
  'accounting-journal-entry',
  'إنشاء قيد يومية يدوي',
  '📝',
  'تسجيل قيد محاسبي متوازن مدين/دائن وترحيله لدفتر الأستاذ.',
  'general-accounting',
  [
    {
      id: 'je-header',
      route: JOURNAL_ENTRY_ROUTE,
      selector: '[data-tour-id="journal-entry-header-fields"]',
      stationTitle: 'الخطوة 1: بيانات القيد',
      title: 'أدخل رقم السند والتاريخ والشرح',
      description: 'هذه البيانات تظهر في دفتر اليومية وكشف الحساب — احرص على شرح واضح ومختصر.',
      side: 'bottom',
      align: 'start',
    },
    {
      id: 'je-lines',
      route: JOURNAL_ENTRY_ROUTE,
      selector: '[data-tour-id="journal-entry-lines-table"]',
      stationTitle: 'الخطوة 2: سطور مدين/دائن',
      title: 'أضف سطور الحسابات',
      description: 'كل سطر يحدد حساباً ومبلغاً مدين أو دائن — لن يسمح النظام بالترحيل قبل توازن الطرفين.',
      side: 'top',
      align: 'center',
    },
    {
      id: 'je-post',
      route: JOURNAL_ENTRY_ROUTE,
      selector: '[data-tour="erp-page-header"]',
      stationTitle: 'الخطوة 3: الترحيل',
      title: 'احفظ ثم رحّل القيد',
      description: 'بعد التوازن، اضغط «ترحيل» ليُقفل القيد في دفتر الأستاذ ويظهر في كشوف الحسابات.',
      side: 'bottom',
      align: 'end',
      trigger: { kind: 'API_SUCCESS', id: 'journal-entry.post-success', prompt: 'اضغط «ترحيل» الآن — تأكد من توازن مدين ودائن.' },
    },
  ],
  true
);

const DAFTAR_OSTAZ_ROUTE = '/accounting/account-reports/books/daftar-ostaz';

const accountingCustomerStatement = buildProgram(
  'accounting-customer-statement',
  'استخراج كشف حساب (دفتر الأستاذ)',
  '📄',
  'عرض حركة حساب محدد مع الرصيد الافتتاحي والختامي لفترة زمنية.',
  'general-accounting',
  [
    {
      id: 'cs-account',
      route: DAFTAR_OSTAZ_ROUTE,
      selector: '[data-tour-id="daftar-ostaz-account-select"]',
      stationTitle: 'الخطوة 1: الحساب',
      title: 'اختر الحساب (عميل أو مورد أو أي حساب)',
      description: 'يمكنك البحث بالكود أو الاسم — الكشف يعمل لأي حساب في الدليل المحاسبي.',
      side: 'bottom',
      align: 'start',
    },
    {
      id: 'cs-dates',
      route: DAFTAR_OSTAZ_ROUTE,
      selector: '[data-tour-id="daftar-ostaz-date-range"]',
      stationTitle: 'الخطوة 2: الفترة الزمنية',
      title: 'حدد الفترة المطلوبة',
      description: 'الرصيد الافتتاحي يُحسب تلقائياً من كل الحركات قبل «من تاريخ».',
      side: 'bottom',
      align: 'center',
    },
    {
      id: 'cs-preview',
      route: DAFTAR_OSTAZ_ROUTE,
      selector: '[data-tour-id="report-preview-btn"]',
      stationTitle: 'الخطوة 3: المعاينة',
      title: 'اضغط «معاينة التقرير»',
      description: 'يفتح الكشف في صفحة قابلة للطباعة والتصدير مباشرة.',
      side: 'top',
      align: 'end',
      trigger: { kind: 'CLICK', id: 'report.preview-click', prompt: 'اضغط «معاينة التقرير» الآن.' },
    },
  ]
);

const REVIEW_BALANCE_ROUTE = '/accounting/account-reports/balances/review-balance';

const accountingTrialBalance = buildProgram(
  'accounting-trial-balance',
  'قراءة ميزان المراجعة',
  '⚖️',
  'التحقق من توازن أرصدة كل الحسابات في تاريخ محدد.',
  'general-accounting',
  [
    {
      id: 'tb-account',
      route: REVIEW_BALANCE_ROUTE,
      selector: '[data-tour-id="review-balance-account-select"]',
      stationTitle: 'الخطوة 1: تصفية اختيارية',
      title: 'اترك الحقل فارغاً لكل الحسابات، أو اختر حساباً محدداً',
      description: 'ميزان المراجعة يجمع كل الحسابات افتراضياً؛ التصفية مفيدة لمراجعة فئة معينة.',
      side: 'bottom',
      align: 'start',
    },
    {
      id: 'tb-date',
      route: REVIEW_BALANCE_ROUTE,
      selector: '[data-tour-id="review-balance-to-date"]',
      stationTitle: 'الخطوة 2: تاريخ الميزان',
      title: 'حدد «إلى تاريخ»',
      description: 'الأرصدة تُحسب كمجموع كل الحركات المرحّلة حتى هذا التاريخ.',
      side: 'bottom',
      align: 'center',
    },
    {
      id: 'tb-preview',
      route: REVIEW_BALANCE_ROUTE,
      selector: '[data-tour-id="report-preview-btn"]',
      stationTitle: 'الخطوة 3: المعاينة',
      title: 'اضغط «معاينة التقرير»',
      description: 'إجمالي المدين يجب أن يساوي إجمالي الدائن — أي فرق يشير لخطأ ترحيل يجب مراجعته فوراً.',
      side: 'top',
      align: 'end',
      trigger: { kind: 'CLICK', id: 'report.preview-click', prompt: 'اضغط «معاينة التقرير» الآن.' },
    },
  ]
);

const RECEIPT_VOUCHER_ROUTE = '/accounting/operations/treasury/receipt-voucher';

const treasuryReceiptVoucher = buildProgram(
  'treasury-receipt-voucher',
  'سند قبض نقدي',
  '🧾',
  'تسجيل تحصيل نقدي أو بنكي من عميل أو أي طرف آخر في الخزينة.',
  'treasury-cheques',
  [
    {
      id: 'rv-safe',
      route: RECEIPT_VOUCHER_ROUTE,
      selector: '[data-tour-id="receipt-voucher-safe"]',
      stationTitle: 'الخطوة 1: الخزينة',
      title: 'اختر الصندوق أو الحساب البنكي',
      description: 'الرصيد الحالي للصندوق يظهر بجانب الاختيار مباشرة قبل الحفظ.',
      side: 'bottom',
      align: 'start',
    },
    {
      id: 'rv-lines',
      route: RECEIPT_VOUCHER_ROUTE,
      selector: '[data-tour-id="receipt-voucher-lines"]',
      stationTitle: 'الخطوة 2: سطور السند',
      title: 'أضف سطر الحساب المقابل والمبلغ',
      description: 'اضغط «إضافة» لإدخال حساب العميل أو أي حساب دائن آخر مع القيمة المحصّلة.',
      side: 'top',
      align: 'center',
    },
    {
      id: 'rv-save',
      route: RECEIPT_VOUCHER_ROUTE,
      selector: '[data-tour-id="receipt-voucher-save"]',
      stationTitle: 'الخطوة 3: الحفظ',
      title: 'احفظ السند',
      description: 'الحفظ يزيد رصيد الصندوق فوراً ويولّد القيد المحاسبي المقابل.',
      side: 'top',
      align: 'end',
      trigger: { kind: 'API_SUCCESS', id: 'treasury-receipt.save-success', prompt: 'اضغط «حفظ» الآن لإتمام سند القبض.' },
    },
  ],
  true
);

const PAYMENT_VOUCHER_ROUTE = '/accounting/operations/treasury/payment-voucher';

const treasuryPaymentVoucher = buildProgram(
  'treasury-payment-voucher',
  'سند صرف نقدي',
  '💸',
  'تسجيل دفعة نقدية أو بنكية لمورد أو أي طرف آخر من الخزينة.',
  'treasury-cheques',
  [
    {
      id: 'pv-safe',
      route: PAYMENT_VOUCHER_ROUTE,
      selector: '[data-tour-id="payment-voucher-safe"]',
      stationTitle: 'الخطوة 1: الخزينة',
      title: 'اختر الصندوق أو الحساب البنكي',
      description: 'تأكد من كفاية الرصيد المتاح قبل تسجيل الصرف.',
      side: 'bottom',
      align: 'start',
    },
    {
      id: 'pv-lines',
      route: PAYMENT_VOUCHER_ROUTE,
      selector: '[data-tour-id="payment-voucher-lines"]',
      stationTitle: 'الخطوة 2: سطور السند',
      title: 'أضف سطر الحساب المقابل والمبلغ',
      description: 'اضغط «إضافة» لإدخال حساب المورد أو أي حساب مدين آخر مع القيمة المصروفة.',
      side: 'top',
      align: 'center',
    },
    {
      id: 'pv-save',
      route: PAYMENT_VOUCHER_ROUTE,
      selector: '[data-tour-id="payment-voucher-save"]',
      stationTitle: 'الخطوة 3: الحفظ',
      title: 'احفظ السند',
      description: 'الحفظ يخصم من رصيد الصندوق فوراً ويولّد القيد المحاسبي المقابل.',
      side: 'top',
      align: 'end',
      trigger: { kind: 'API_SUCCESS', id: 'treasury-payment.save-success', prompt: 'اضغط «حفظ» الآن لإتمام سند الصرف.' },
    },
  ],
  true
);

const CHEQUES_ROUTE = '/accounting/operations/treasury/cheques';

const treasuryChequeLifecycle = buildProgram(
  'treasury-cheque-lifecycle',
  'دورة حياة الشيك الكاملة',
  '📑',
  'من تسجيل شيك وارد أو صادر حتى الإرسال للبنك والتحصيل أو الارتجاع.',
  'treasury-cheques',
  [
    {
      id: 'ch-tabs',
      route: CHEQUES_ROUTE,
      selector: '[data-tour-id="cheques-tabs"]',
      stationTitle: 'الخطوة 1: نوع الشيك',
      title: 'تنقّل بين شيكات واردة وصادرة والإجراءات',
      description: 'الشيكات الواردة تأتي من عملاء، والصادرة تُسلَّم لموردين. تبويب «إجراءات» يدير دورة حياة أي شيك.',
      side: 'bottom',
      align: 'start',
    },
    {
      id: 'ch-inward',
      route: CHEQUES_ROUTE,
      selector: '[data-tour-id="cheques-inward-form"]',
      stationTitle: 'الخطوة 2: تسجيل شيك وارد',
      title: 'أدخل بيانات الشيك والعميل',
      description: 'رقم الشيك، المبلغ، تاريخ الاستحقاق، والعميل — اضغط «حفظ شيك وارد» ليصبح جاهزاً للإرسال إلى البنك.',
      side: 'top',
      align: 'center',
    },
    {
      id: 'ch-lifecycle',
      route: CHEQUES_ROUTE,
      selector: '[data-tour-id="cheques-lifecycle-actions"]',
      stationTitle: 'الخطوة 3: إرسال، تحصيل، أو ارتجاع',
      title: 'أدر دورة حياة الشيك بمعرّفه',
      description: 'ألصق معرّف الشيك من نتيجة الحفظ، ثم استخدم أزرار «إرسال للبنك»، «تحصيل»، أو «ارتجاع» بحسب الحالة.',
      side: 'top',
      align: 'center',
    },
  ]
);

export const EXTENDED_ACADEMY_PROGRAMS: Record<ExtendedAcademyProgramId, AcademyProgram> = {
  'sales-first-invoice': salesFirstInvoice,
  'sales-cash-collection': salesCashCollection,
  'sales-return-flow': salesReturnFlow,
  'inventory-goods-receipt': inventoryGoodsReceipt,
  'inventory-stock-transfer': inventoryStockTransfer,
  'inventory-stocktaking-flow': inventoryStocktakingFlow,
  'accounting-journal-entry': accountingJournalEntry,
  'accounting-customer-statement': accountingCustomerStatement,
  'accounting-trial-balance': accountingTrialBalance,
  'treasury-receipt-voucher': treasuryReceiptVoucher,
  'treasury-payment-voucher': treasuryPaymentVoucher,
  'treasury-cheque-lifecycle': treasuryChequeLifecycle,
};
