/** Maps backend / API English messages to Arabic for end users. */

type Rule = {
  test: RegExp;
  ar: string | ((match: RegExpMatchArray, raw: string) => string);
};

const EXACT: Record<string, string> = {
  'validation error': 'يرجى التحقق من الحقول المدخلة',
  'company id is required': 'معرّف الشركة مطلوب',
  'company context is required': 'يجب اختيار الشركة',
  'branch context is required for posting (send x-branch-id)': 'يجب اختيار الفرع قبل الترحيل',
  'authentication required': 'يجب تسجيل الدخول',
  'insufficient permissions': 'لا تملك صلاحية لهذه العملية',
  'an internal server error occurred': 'حدث خطأ داخلي في الخادم',
  'an error occurred while processing your request': 'حدث خطأ أثناء معالجة الطلب',
  'a database error occurred.': 'حدث خطأ في قاعدة البيانات',
  'failed to parse response': 'تعذّر قراءة استجابة الخادم',
  'request failed': 'فشل الطلب',
  'http 304: not modified': 'تعذّر تحديث البيانات المخزّنة — حدّث الصفحة.',
  'record not found.': 'السجل غير موجود',
  'item not found': 'الصنف غير موجود',
  'unit not found': 'الوحدة غير موجود',
  'item unit not found': 'وحدة الصنف غير موجودة',
  'warehouse not found': 'المخزن غير موجود',
  'customer not found': 'العميل غير موجود',
  'supplier not found': 'المورد غير موجود',
  'securities receipt not found': 'ورقة المقبوضات غير موجودة',
  'securities payment not found': 'ورقة المدفوعات غير موجودة',
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
  'cannot unapprove a posted journal entry': 'تم إلغاء الاعتماد — يمكنك فك الترحيل الآن',
  'journal entry is not approved': 'القيد غير معتمد',
  'invoice is not approved': 'الفاتورة غير معتمدة',
  'line quantity must be greater than 0': 'كمية السطر يجب أن تكون أكبر من صفر',
  'base quantity must be greater than 0': 'الكمية الأساسية يجب أن تكون أكبر من صفر',
  'quote already converted': 'تم تحويل عرض السعر مسبقاً',
  'inventory gl account is not configured in company settings':
    'حساب المخزون غير مضبوط في إعدادات الشركة',
  'stock issue expense account is not configured in company settings':
    'حساب مصروف الصرف غير مضبوط في إعدادات الشركة',
  'operation failed: a related record does not exist.': 'تعذّرت العملية — سجل مرتبط غير موجود',
  'invalid data: a required relation is missing.': 'بيانات غير صالحة — علاقة مطلوبة ناقصة',
  'from date and to date are required': 'يرجى اختيار تاريخ البداية والنهاية',
  'failed to get sales report': 'تعذّر تحميل تقرير المبيعات',
  'failed to list delegates': 'تعذّر تحميل قائمة المندوبين',
  'failed to list currencies': 'تعذّر تحميل قائمة العملات',
  'request timeout': 'انتهت مهلة الطلب — حاول مرة أخرى.',
  'internal server error': 'حدث خطأ داخلي في الخادم.',
  'socket hang up': 'انقطع الاتصال بالخادم. تأكد أن gates-backend شغال ثم حدّث الصفحة.',
  'econnreset': 'انقطع الاتصال بالخادم. تأكد أن gates-backend شغال ثم حدّث الصفحة.',
  'econnrefused': 'تعذّر الاتصال بالخادم — شغّل gates-backend على المنفذ 3001 ثم حدّث الصفحة.',
  'cannot set headers after they are sent to the client':
    'انقطع رد المساعد أثناء الإرسال. أعد المحاولة.',
  'err_http_headers_sent': 'انقطع رد المساعد أثناء الإرسال. أعد المحاولة.',
};

const RULES: Rule[] = [
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
    test: /is already posted/i,
    ar: 'المستند مرحّل مسبقاً.',
  },
  {
    test: /is not posted/i,
    ar: 'المستند غير مرحّل.',
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
    ar: 'يوجد سجل بنفس البيانات مسبقاً.',
  },
  {
    test: /fiscal year is closed|closed for this document date/i,
    ar: 'السنة المالية مغلقة — لا يمكن تنفيذ العملية.',
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
    ar: 'الخادم غير متاح حالياً — تأكد أن gates-backend شغال على المنفذ 3001.',
  },
  {
    test: /http 500|internal server error/i,
    ar: 'حدث خطأ داخلي في الخادم.',
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
    return 'تعذّر تنفيذ العملية. راجع البيانات أو تواصل مع الدعم إذا استمر الخطأ.';
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
