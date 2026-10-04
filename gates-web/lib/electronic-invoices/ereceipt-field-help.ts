export type FieldHelp = {
  labelAr: string;
  labelEn: string;
  explanationAr: string;
  helpAr: string;
  required: boolean;
  example?: string;
};

export const ERECEIPT_FIELD_HELP: Record<string, FieldHelp> = {
  environment: {
    labelAr: 'بيئة الاختبار أو الإنتاج',
    labelEn: 'Environment',
    explanationAr: 'تحدد هل الإرسال إلى منصة ETA التجريبية أو الإنتاج الحقيقي.',
    helpAr: 'ابدأ دائمًا بـ PREPRODUCTION حتى ينجح أول إيصال تجريبي، ثم أنشئ جهازًا منفصلًا للإنتاج.',
    required: true,
    example: 'PREPRODUCTION',
  },
  gatesTerminal: {
    labelAr: 'طرفية نقطة البيع في Gates',
    labelEn: 'Gates POS Terminal',
    explanationAr: 'الطرفية التي ينفذ منها الكاشير عمليات البيع في نظام Gates.',
    helpAr: 'من إعدادات نقاط البيع → أجهزة نقطة البيع. اختر الطرفية التي ستُربط بنفس جهاز ETA.',
    required: true,
  },
  posSerial: {
    labelAr: 'الرقم التسلسلي لجهاز نقطة البيع لدى الضرائب',
    labelEn: 'ETA POS Serial',
    explanationAr: 'هو الرقم الذي تم تسجيل جهاز نقطة البيع به لدى منظومة الإيصال الإلكتروني.',
    helpAr:
      'تحصل عليه من بيانات جهاز POS المسجل لدى مصلحة الضرائب. لا تستخدم الرقم التسلسلي للكمبيوتر إلا إذا كان هو نفسه الرقم المسجل لدى ETA.',
    required: true,
    example: 'حسب تسجيل ETA',
  },
  branchCode: {
    labelAr: 'كود الفرع لدى الضرائب',
    labelEn: 'ETA Branch Code',
    explanationAr: 'يُعرّف الفرع الضريبي المرتبط بجهاز نقطة البيع عند المصلحة.',
    helpAr: 'من بيانات تسجيل الفرع/الجهاز في بوابة مصلحة الضرائب أو من فريق الدعم الضريبي.',
    required: true,
  },
  activityCode: {
    labelAr: 'كود النشاط الضريبي',
    labelEn: 'Activity Code',
    explanationAr: 'النشاط الاقتصادي المسجل للمنشأة أو للفرع عند المصلحة.',
    helpAr: 'من شهادة التسجيل أو إعدادات الفرع في Gates إن كان مطابقًا لما سجّلته عند ETA.',
    required: true,
    example: '4 أرقام حسب التسجيل',
  },
  posOsVersion: {
    labelAr: 'إصدار نظام تشغيل نقطة البيع',
    labelEn: 'POS OS Version',
    explanationAr: 'يُرسل مع تعريف الجهاز عند مصادقة ETA (وليس إصدار Windows فقط إن كان مختلفًا في التسجيل).',
    helpAr: 'أدخل القيمة كما سجّلتها عند تفعيل الجهاز لدى المصلحة.',
    required: true,
    example: '10.0',
  },
  posFramework: {
    labelAr: 'POS Model / Framework',
    labelEn: 'POS Model Framework',
    explanationAr: 'حقل قصير (10 أحرف) يصف إطار/نموذج الجهاز في تعريف ETA.',
    helpAr: 'من وثائق تسجيل جهاز POS — لا يولّده Gates تلقائيًا.',
    required: true,
  },
  clientId: {
    labelAr: 'معرّف العميل (Client ID)',
    labelEn: 'Client ID',
    explanationAr: 'يُستخدم للاتصال الآمن بمنصة الإيصال الإلكتروني.',
    helpAr: 'من بيانات تفعيل جهاز POS أو بوابة المطورين لدى مصلحة الضرائب.',
    required: true,
  },
  clientSecret: {
    labelAr: 'سر العميل (Client Secret)',
    labelEn: 'Client Secret',
    explanationAr: 'سرّ يُستخدم مع Client ID للمصادقة — لا يُعرض بعد الحفظ.',
    helpAr: 'يتم حفظ هذه القيمة مشفرة ولا يتم عرضها مرة أخرى. اترك الحقل فارغًا عند التعديل للإبقاء على القيمة الحالية.',
    required: true,
  },
  presharedKey: {
    labelAr: 'المفتاح المشترك (Pre-shared Key)',
    labelEn: 'Pre-shared Key',
    explanationAr: 'مفتاح إضافي مطلوب لتفعيل جهاز POS لدى ETA.',
    helpAr: 'يتم حفظ هذه القيمة مشفرة ولا يتم عرضها مرة أخرى. اترك الحقل فارغًا عند التعديل للإبقاء على القيمة الحالية.',
    required: true,
  },
  receiptTypes: {
    labelAr: 'أنواع الإيصال',
    labelEn: 'Receipt Types',
    explanationAr: 'بيع (s) ومرتجع (r) يكفيان لمعظم محلات التجزئة.',
    helpAr: 'الأنواع المتقدمة للقطاعات الخاصة تظهر تحت «إعدادات متقدمة».',
    required: true,
  },
  deliveryMode: {
    labelAr: 'طريقة تسليم الطلب',
    labelEn: 'Order Delivery Mode',
    explanationAr: 'مطلوب لبعض أنواع إيصالات القطاعات فقط.',
    helpAr: 'اتركه فارغًا للبيع والمرتجع العادي.',
    required: false,
  },
  paymentMapping: {
    labelAr: 'ربط طرق الدفع',
    labelEn: 'Payment Mapping',
    explanationAr: 'يحوّل طريقة الدفع في Gates إلى رمز الدفع المعتمد من ETA.',
    helpAr: 'الافتراضي مناسب لمعظم الحالات — غيّر فقط عند توجيه من المصلحة.',
    required: false,
  },
  rwr: {
    labelAr: 'مرتجع بدون مرجع (RWR)',
    labelEn: 'Return Without Reference',
    explanationAr: 'إجراء خاص يتطلب أسبابًا رسمية من ETA.',
    helpAr: 'اتركه معطّلًا إلا إذا فعّلته المصلحة لنشاطك.',
    required: false,
  },
  signingMode: {
    labelAr: 'توقيع دفعات الإيصال',
    labelEn: 'Batch Signature Mode',
    explanationAr: 'منفصل تمامًا عن توقيع الفاتورة الإلكترونية (eSeal).',
    helpAr: 'اتركه معطّلًا حتى تطلب المصلحة توقيع CAdES للإيصالات.',
    required: false,
  },
};

export const WIZARD_STEPS = [
  { id: 1, titleAr: 'بيانات الشركة' },
  { id: 2, titleAr: 'جهاز نقطة البيع' },
  { id: 3, titleAr: 'بيانات الربط مع الضرائب' },
  { id: 4, titleAr: 'إعدادات الإيصال' },
  { id: 5, titleAr: 'فحص الجاهزية' },
  { id: 6, titleAr: 'إرسال إيصال تجريبي' },
] as const;
