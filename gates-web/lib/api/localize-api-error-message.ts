/** Maps backend / API English messages to Arabic for end users. */

type Rule = {
  test: RegExp;
  ar: string | ((match: RegExpMatchArray, raw: string) => string);
};

const EXACT: Record<string, string> = {
  'validation error': 'بعض الحقول غير صحيحة. الحل: راجع الحقول المعلّمة ثم أعد الحفظ.',
  'company id is required': 'معرّف الشركة مطلوب',
  'company context is required': 'يجب اختيار الشركة',
  'branch context is required for posting (send x-branch-id)': 'يجب اختيار الفرع قبل الترحيل',
  'branch context is required (x-branch-id or token branch_id)': 'يجب اختيار الفرع قبل الترحيل',
  'journal entry not found': 'القيد غير موجود',
  'journal entry is already posted': 'القيد مرحّل مسبقاً',
  'journal entry document is not open for posting': 'مستند القيد غير مفتوح للترحيل',
  'journal entry belongs to a different branch': 'القيد يتبع فرعاً آخر. غيّر الفرع ثم أعد الترحيل.',
  'posting to general ledger is disabled for this company': 'ترحيل القيود مقفول لهذه الشركة',
  'cannot post: debit and credit base totals differ':
    'لا يمكن ترحيل قيد غير متزن. ساوِ إجمالي المدين مع إجمالي الدائن ثم أعد الحفظ.',
  'failed to post journal entry': 'تعذّر ترحيل القيد',
  'failed to get journal entry': 'تعذّر تحميل القيد',
  'authentication required': 'يجب تسجيل الدخول',
  'insufficient permissions':
    'لا تملك صلاحية لهذه العملية. الحل: اطلب من المدير إضافة الصلاحية لمجموعتك.',
  'an internal server error occurred':
    'حدث خطأ غير متوقع. الحل: حدّث الصفحة وأعد المحاولة.',
  'an error occurred while processing your request':
    'حدث خطأ أثناء تنفيذ العملية. الحل: حدّث الصفحة وأعد المحاولة.',
  'a database error occurred.':
    'تعذّر حفظ البيانات. الحل: راجع الحقول وأعد المحاولة.',
  'failed to parse response': 'تعذّر قراءة استجابة الخادم',
  'request failed': 'فشل الطلب',
  'http 304: not modified': 'تعذّر تحديث البيانات المخزّنة — حدّث الصفحة.',
  'maximum call stack size exceeded':
    'حصل تكرار لا نهائي أثناء عرض الصفحة. حدّث الصفحة ثم أعد المحاولة.',
  'record not found.': 'السجل غير موجود',
  'item not found': 'الصنف غير موجود',
  'unit not found': 'الوحدة غير موجود',
  'item unit not found': 'وحدة الصنف غير موجودة',
  'warehouse not found': 'المخزن غير موجود',
  'customer not found': 'العميل غير موجود',
  'supplier not found': 'المورد غير موجود',
  'securities receipt not found': 'ورقة المقبوضات غير موجودة',
  'securities payment not found': 'ورقة المدفوعات غير موجودة',
  'cheque gl accounts are not fully configured in company accountdefinitions':
    'اختر حساب التحصيل (خزينة أو بنك). حسابات الشيكات غير مضبوطة في إعدادات الشركة.',
  'securities receipt is already posted': 'تم تحصيل ورقة المقبوضات مسبقاً',
  'securities payment is already posted': 'تم تحصيل ورقة المدفوعات مسبقاً',
  'securities receipt is already cancelled': 'ورقة المقبوضات مرتدة أو ملغاة بالفعل',
  'securities payment is already cancelled': 'ورقة المدفوعات مرتدة أو ملغاة بالفعل',
  'cannot post a cancelled securities receipt': 'لا يمكن تحصيل ورقة مقبوضات ملغاة',
  'cannot post a cancelled securities payment': 'لا يمكن تحصيل ورقة مدفوعات ملغاة',
  'cannot endorse a cancelled securities receipt': 'لا يمكن تظهير ورقة ملغاة',
  'unpost the securities receipt before endorsing it': 'ألغِ التحصيل أولاً قبل التظهير',
  'customer or supplier is required': 'يجب اختيار عميل أو مورد',
  'either customer or supplier must be provided': 'يجب اختيار عميل أو مورد',
  'customer or supplier is required to post a securities receipt': 'يجب اختيار الجهة قبل التحصيل',
  'customer or supplier is required to post a securities payment': 'يجب اختيار الجهة قبل التحصيل',
  'cannot cancel a posted securities receipt. unpost it first.':
    'لا يمكن إلغاء ورقة محصّلة — استخدم الارتداد',
  'cannot cancel a posted securities payment. unpost it first.':
    'لا يمكن إلغاء ورقة محصّلة — استخدم الارتداد',
  'cannot update a posted securities receipt': 'لا يمكن تعديل ورقة محصّلة',
  'cannot update a posted securities payment': 'لا يمكن تعديل ورقة محصّلة',
  'cannot update a cancelled securities receipt': 'لا يمكن تعديل ورقة ملغاة',
  'cannot update a cancelled securities payment': 'لا يمكن تعديل ورقة ملغاة',
  'invoice not found': 'الفاتورة غير موجودة',
  'company not found': 'الشركة غير موجودة',
  'account not found': 'الحساب غير موجود',
  'assembly not found': 'مستند التجميع غير موجود',
  'disassembly not found': 'مستند التفكيك غير موجود',
  'opening stock not found': 'رصيد افتتاحي غير موجود',
  'transfer not found': 'مستند التحويل غير موجود',
  'stocktaking not found': 'جرد المخزون غير موجود',
  'other adjustment not found': 'التسوية غير موجودة',
  'price quote not found': 'عرض السعر غير موجود',
  'linked supplier not found': 'المورد المرتبط غير موجود',
  'linked customer not found': 'العميل المرتبط غير موجود',
  'unpost the invoice before editing it': 'ألغِ ترحيل الفاتورة قبل التعديل',
  'cancelled invoices cannot be edited': 'لا يمكن تعديل فاتورة ملغاة',
  'unpost the invoice before cancelling it': 'ألغِ ترحيل الفاتورة قبل الإلغاء',
  'posted invoices cannot be deleted — unpost or cancel instead':
    'لا يمكن حذف فاتورة مرحّلة — ألغِ الترحيل أو ألغِ المستند',
  'invoice has settlements — cancel it instead of deleting':
    'الفاتورة عليها تحصيلات — استخدم الإلغاء بدلاً من الحذف',
  'post the invoice before recording a settlement': 'رحّل الفاتورة قبل تسجيل التحصيل',
  'invoice must be posted before collecting payment': 'يجب ترحيل الفاتورة قبل التحصيل',
  'invoice must be posted before approval': 'يجب ترحيل الفاتورة قبل الاعتماد',
  'error getting journal entry': 'تعذّر تحميل القيد',
  'failed to get journal entry': 'تعذّر تحميل القيد',
  'cannot unapprove a posted journal entry': 'تم إلغاء الاعتماد — يمكنك فك الترحيل الآن',
  'cannot update a posted journal entry':
    'القيد مرحّل ولا يمكن تعديله. فك الترحيل أولاً من قائمة (...).',
  'cannot update a cancelled journal entry': 'القيد ملغي ولا يمكن تعديله',
  'journal entry is deleted': 'القيد محذوف',
  'journal entry is not approved': 'القيد غير معتمد',
  'journal entry is not cancelled': 'القيد ليس ملغياً',
  'cannot post a cancelled journal entry': 'لا يمكن ترحيل قيد ملغي',
  'journal entry cannot be posted in current workflow state':
    'لا يمكن ترحيل القيد في حالته الحالية',
  'invoice is not approved': 'الفاتورة غير معتمدة',
  'line quantity must be greater than 0': 'كمية السطر يجب أن تكون أكبر من صفر',
  'base quantity must be greater than 0': 'الكمية الأساسية يجب أن تكون أكبر من صفر',
  'quote already converted': 'تم تحويل عرض السعر مسبقاً',
  'inventory gl account is not configured in company settings':
    'حساب المخزون غير مضبوط في إعدادات الشركة',
  'stock issue expense account is not configured in company settings':
    'حساب مصروف الصرف غير مضبوط في إعدادات الشركة',
  'operation failed: a related record does not exist.':
    'تعذّر الحفظ لأن بياناً مرتبطاً غير موجود. الحل: تأكد أن الحساب أو الصنف أو المخزن المختار ما زال موجوداً.',
  'invalid data: a required relation is missing.':
    'بيانات غير مكتملة — علاقة مطلوبة ناقصة. الحل: أكمل الحقول المرتبطة ثم احفظ.',
  'from date and to date are required': 'يرجى اختيار تاريخ البداية والنهاية',
  'failed to get sales report': 'تعذّر تحميل تقرير المبيعات',
  'failed to list delegates': 'تعذّر تحميل قائمة المندوبين',
  'failed to create delegate': 'تعذّر حفظ المندوب. الحل: راجع الرمز والاسم ثم أعد المحاولة.',
  'failed to update delegate': 'تعذّر حفظ المندوب. الحل: راجع الرمز والاسم ثم أعد المحاولة.',
  'failed to delete delegate': 'تعذّر حذف المندوب. الحل: حدّث الدليل ثم أعد المحاولة.',
  'delegate not found': 'المندوب غير موجود. الحل: حدّث الدليل ثم أعد المحاولة.',
  'failed to list cost centers': 'تعذّر تحميل دليل مراكز التكلفة',
  'failed to create cost center':
    'تعذّر حفظ مركز التكلفة. الحل: راجع المركز الأب والحركات المرتبطة به.',
  'failed to update cost center':
    'تعذّر حفظ مركز التكلفة. الحل: راجع المركز الأب والحركات المرتبطة به.',
  'failed to delete cost center':
    'تعذّر حذف مركز التكلفة. الحل: انقل الحركات من شاشة «نقل حركة مركز التكلفة» أو احذف المراكز الفرعية أولاً.',
  'cost center not found': 'مركز التكلفة غير موجود. الحل: حدّث الدليل ثم أعد المحاولة.',
  'failed to list currencies': 'تعذّر تحميل قائمة العملات',
  'request timeout': 'انتهت مهلة الطلب — حاول مرة أخرى.',
  'internal server error':
    'حدث خطأ غير متوقع. الحل: حدّث الصفحة وأعد المحاولة.',
  'socket hang up': 'انقطع الاتصال بالخادم. تأكد أن gates-backend شغال ثم حدّث الصفحة.',
  'econnreset': 'انقطع الاتصال بالخادم. تأكد أن gates-backend شغال ثم حدّث الصفحة.',
  'econnrefused': 'تعذّر الاتصال بالخادم — شغّل gates-backend على المنفذ 3001 ثم حدّث الصفحة.',
  'cannot set headers after they are sent to the client':
    'انقطع رد المساعد أثناء الإرسال. أعد المحاولة.',
  'err_http_headers_sent': 'انقطع رد المساعد أثناء الإرسال. أعد المحاولة.',
};

const RULES: Rule[] = [
  {
    test: /maximum call stack size exceeded/i,
    ar: 'حصل تكرار لا نهائي أثناء عرض الصفحة. حدّث الصفحة ثم أعد المحاولة.',
  },
  {
    test: /negative stock not allowed/i,
    ar: 'لا يُسمح برصيد سالب — الكمية المطلوبة أكبر من المتاح في المخزن.',
  },
  {
    test: /insufficient quantity.*?available:\s*([\d.]+),\s*required:\s*([\d.]+)/i,
    ar: (m) => `الكمية غير كافية — المتاح: ${m[1]}، المطلوب: ${m[2]}.`,
  },
  {
    test: /insufficient component quantity.*?available:\s*([\d.]+),\s*required:\s*([\d.]+)/i,
    ar: (m) => `كمية المكوّن غير كافية — المتاح: ${m[1]}، المطلوب: ${m[2]}.`,
  },
  {
    test: /cannot unpost an approved/i,
    ar: 'تم تعطيل قفل الاعتماد — أعد فك الترحيل. لو استمر الخطأ حدّث الصفحة.',
  },
  {
    test: /cannot unpost:?\s*insufficient.*?current:\s*([\d.]+),\s*required:\s*([\d.]+)/i,
    ar: (m) => `تعذّر فك الترحيل — الرصيد الحالي (${m[1]}) أقل من المطلوب (${m[2]}).`,
  },
  {
    test: /payment amount \(([\d.]+)\) exceeds invoice net amount \(([\d.]+)\)/i,
    ar: (m) => `مبلغ التحصيل (${m[1]}) أكبر من صافي الفاتورة (${m[2]}).`,
  },
  {
    test: /warehouse not found or does not belong to company/i,
    ar: 'المخزن غير موجود أو لا يتبع هذه الشركة.',
  },
  {
    test: /one or more items not found or do not belong to company/i,
    ar: 'صنف أو أكثر غير موجود أو لا يتبع الشركة.',
  },
  {
    test: /one or more warehouses not found or do not belong to company/i,
    ar: 'مخزن أو أكثر غير موجود أو لا يتبع الشركة.',
  },
  {
    test: /source warehouse not found or does not belong to company/i,
    ar: 'مخزن المصدر غير موجود أو لا يتبع الشركة.',
  },
  {
    test: /destination warehouse not found or does not belong to company/i,
    ar: 'مخزن الوجهة غير موجود أو لا يتبع الشركة.',
  },
  {
    test: /cannot post cancelled/i,
    ar: 'لا يمكن ترحيل مستند ملغى.',
  },
  {
    test: /not balanced|unbalanced journal/i,
    ar: 'القيد غير متزن. ساوِ إجمالي المدين مع إجمالي الدائن ثم احفظ.',
  },
  {
    test: /does not fall within|no fiscal year|outside the header fiscal year/i,
    ar: 'التاريخ المحدد لا يقع ضمن سنة مالية مفتوحة. للقيد الافتتاحي وبضاعة أول المدة يُقبل تاريخ بداية المدة أو اليوم السابق لها.',
  },
  {
    test: /opening (journal|balance) already|قيد افتتاحي بالفعل/i,
    ar: 'يوجد قيد افتتاحي بالفعل. احذفه أولاً حتى يمكن إنشاء قيد جديد.',
  },
  {
    test: /opening stock already|كشف بضاعة أول المدة بالفعل/i,
    ar: 'يوجد كشف بضاعة أول المدة بالفعل. احذفه أولاً حتى يمكن إنشاء كشف جديد.',
  },
  {
    test: /failed to (create|list|get|update|delete) opening stock/i,
    ar: (m) =>
      m[1] === 'list'
        ? 'تعذر تحميل كشوف بضاعة أول المدة. حدّث الصفحة ثم أعد المحاولة.'
        : 'تعذر حفظ بضاعة أول المدة. راجع الأصناف والمخزن ثم أعد المحاولة.',
  },
  {
    test: /failed to list warehouses/i,
    ar: 'تعذر تحميل دليل المخازن. حدّث الصفحة ثم أعد المحاولة.',
  },
  {
    test: /غير\s*مرح|unposted|not posted/i,
    ar: (m, raw) =>
      /يوجد|فاتورة|قيد|خزين/.test(raw)
        ? raw
        : 'يوجد مستندات غير مرحلة. رحّلها من شاشاتها ثم أعد المحاولة.',
  },
  {
    test: /already posted by another|is already posted/i,
    ar: 'المستند مرحّل مسبقاً.',
  },
  {
    test: /advancedrights|not permitted to post general ledger/i,
    ar: 'ليس لديك صلاحية ترحيل القيود. اطلب من المدير تفعيل ترحيل دفتر الأستاذ.',
  },
  {
    test: /journal entry belongs to a different branch/i,
    ar: 'القيد يتبع فرعاً آخر. غيّر الفرع ثم أعد الترحيل.',
  },
  {
    test: /document is not open for posting/i,
    ar: 'مستند القيد غير مفتوح للترحيل',
  },
  {
    test: /posting to general ledger is disabled/i,
    ar: 'ترحيل القيود مقفول لهذه الشركة',
  },
  {
    test: /is already cancelled/i,
    ar: 'المستند ملغى مسبقاً.',
  },
  {
    test: /cannot cancel posted .* unpost it first/i,
    ar: 'لا يمكن إلغاء مستند مرحّل — ألغِ الترحيل أولاً.',
  },
  {
    test: /amount exceeds maximum offset/i,
    ar: 'المبلغ أكبر من الحد الأقصى للمقاصة.',
  },
  {
    test: /a record with this .+ already exists/i,
    ar: 'يوجد سجل بنفس الرقم أو الاسم. الحل: غيّر القيمة المكررة ثم احفظ.',
  },
  {
    test: /fiscal year is closed|closed for this document date/i,
    ar: 'السنة المالية مغلقة. الحل: افتح الفترة من شاشة الفترات المحاسبية أو غيّر تاريخ المستند لفترة مفتوحة.',
  },
  {
    test: /not licensed for this tenant|subscription is not active/i,
    ar: 'هذه الوحدة غير مرخصة لشركتك أو انتهى الاشتراك.',
  },
  {
    test: /x-company-id does not match authenticated company/i,
    ar: 'سياق الشركة لا يطابق جلسة الدخول.',
  },
  {
    test: /from date and to date are required/i,
    ar: 'يرجى اختيار تاريخ البداية والنهاية',
  },
  {
    test: /failed to get .+ report/i,
    ar: 'تعذّر تحميل التقرير',
  },
  {
    test: /failed to fetch|econnrefused|econnreset|socket hang up|enotfound|epipe|etimedout/i,
    ar: 'تعذّر الاتصال بالخادم — شغّل gates-backend ثم حدّث الصفحة.',
  },
  {
    test: /cannot set headers after they are sent|err_http_headers_sent/i,
    ar: 'انقطع رد المساعد أثناء الإرسال. أعد المحاولة.',
  },
  {
    test: /function tools with reasoning_effort|reasoning_effort are not supported/i,
    ar: 'تعذّر استدعاء أدوات Gates Intelligence. أعد المحاولة.',
  },
  {
    test: /http 50[234]|bad gateway|service unavailable|gateway timeout/i,
    ar: 'الخادم غير متاح حالياً. الحل: تأكد أن gates-backend شغال على المنفذ 3001 ثم حدّث الصفحة.',
  },
  {
    test: /http 500|internal server error/i,
    ar: 'حدث خطأ غير متوقع. الحل: حدّث الصفحة وأعد المحاولة.',
  },
  {
    test: /unique constraint|already exists/i,
    ar: 'يوجد سجل بنفس هذه البيانات. الحل: غيّر الرقم أو الاسم المكرر ثم احفظ.',
  },
  {
    test: /رقم السند مستخدم|voucher number already exists|legacyglnum/i,
    ar: 'رقم السند مستخدم من قبل. غيّر الرقم ثم احفظ.',
  },
  {
    test: /failed to create account|failed to update account|failed to delete account/i,
    ar: 'تعذّر حفظ الحساب. الحل: راجع الحساب الأب والحركات المرتبطة به.',
  },
  {
    test: /failed to create cost center|failed to update cost center|failed to delete cost center/i,
    ar: 'تعذّر حفظ مركز التكلفة. الحل: راجع المركز الأب والحركات المرتبطة به، أو انقل الحركة من شاشة «نقل حركة مركز التكلفة».',
  },
  {
    test: /failed to create delegate|failed to update delegate|failed to delete delegate/i,
    ar: 'تعذّر حفظ المندوب. الحل: راجع الرمز والاسم ثم أعد المحاولة.',
  },
  {
    test: /^http 404|cannot get /i,
    ar: 'المسار غير موجود على الخادم.',
  },
  {
    test: /http 304|not modified/i,
    ar: 'تعذّر تحديث البيانات المخزّنة — حدّث الصفحة.',
  },
  {
    test: /^(.+) is required \(iso date\)$/i,
    ar: (m) => `الحقل «${m[1]}» مطلوب (تاريخ بصيغة ISO).`,
  },
  {
    test: /^invalid (.+)$/i,
    ar: (m) => `قيمة غير صالحة: ${m[1]}.`,
  },
  {
    test: /^(.+) not found\.?$/i,
    ar: (m) => {
      const entity = m[1].trim().toLowerCase();
      const map: Record<string, string> = {
        item: 'الصنف',
        unit: 'الوحدة',
        customer: 'العميل',
        supplier: 'المورد',
        invoice: 'الفاتورة',
        warehouse: 'المخزن',
        company: 'الشركة',
        account: 'الحساب',
        'cost center': 'مركز التكلفة',
        delegate: 'المندوب',
        'journal entry': 'القيد',
        record: 'السجل',
      };
      const arEntity = map[entity] ?? 'السجل';
      return `${arEntity} غير موجود.`;
    },
  },
];

const FISCAL_CLOSED_PATTERNS = [/fiscal year is closed/i, /closed for this document date/i];
const LICENSE_PATTERNS = [/not licensed for this tenant/i, /subscription is not active/i];

function containsArabic(text: string): boolean {
  return /[\u0600-\u06FF]/.test(text);
}

function looksLikeEnglishUserMessage(text: string): boolean {
  if (!text.trim()) return false;
  if (containsArabic(text)) return false;
  return /[a-zA-Z]/.test(text);
}

function applyRules(message: string): string | null {
  const trimmed = message.trim();
  const exact = EXACT[trimmed.toLowerCase()];
  if (exact) return exact;

  for (const rule of RULES) {
    const m = trimmed.match(rule.test);
    if (m) {
      return typeof rule.ar === 'function' ? rule.ar(m, trimmed) : rule.ar;
    }
  }
  return null;
}

export function localizeApiErrorMessage(message: string, httpStatus?: number): string {
  const raw = message?.trim() || '';
  if (!raw) return 'حدث خطأ غير متوقع';

  if (containsArabic(raw)) return raw;

  if (httpStatus === 401) {
    return 'انتهت صلاحية الجلسة — يرجى تسجيل الدخول مرة أخرى.';
  }
  if (/quota|credit_balance|no credits remaining|insufficient_quota|billing/i.test(raw) || httpStatus === 402) {
    return 'رصيد OpenAI نفد. أضف رصيد من Billing في OpenAI ثم أعد المحاولة.';
  }
  if (httpStatus === 429 || /too many requests/i.test(raw)) {
    return 'طلبات كثيرة — انتظر دقيقة ثم حدّث الصفحة.';
  }
  if (FISCAL_CLOSED_PATTERNS.some((re) => re.test(raw))) {
    return 'السنة المالية مغلقة — لا يمكن تنفيذ العملية.';
  }
  if (LICENSE_PATTERNS.some((re) => re.test(raw))) {
    return 'هذه الوحدة غير مرخصة لشركتك أو انتهى الاشتراك.';
  }
  if (httpStatus === 403 && /company/i.test(raw)) {
    const mapped = applyRules(raw);
    return mapped ?? raw;
  }

  const mapped = applyRules(raw);
  if (mapped) return mapped;

  if (looksLikeEnglishUserMessage(raw)) {
    return 'تعذّر تنفيذ العملية. الحل: راجع البيانات المدخلة وأعد المحاولة. لو تكرر الخطأ بعد التصحيح حدّث الصفحة.';
  }

  return raw;
}

/** Normalize any thrown value to a localized Arabic user message. */
export function localizeUnknownError(error: unknown, httpStatus?: number): string {
  if (error == null) return 'حدث خطأ غير متوقع';
  if (typeof error === 'string') return localizeApiErrorMessage(error, httpStatus);
  if (error instanceof Error) {
    const code = (error as Error & { code?: string }).code;
    const status =
      httpStatus ??
      (code && /^\d+$/.test(code) ? Number.parseInt(code, 10) : undefined);
    return localizeApiErrorMessage(error.message, status);
  }
  return localizeApiErrorMessage(String(error), httpStatus);
}
