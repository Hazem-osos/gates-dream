import type { ApiError } from './types';
import { localizeApiErrorMessage } from './localize-api-error-message';

type ValidationIssue = { path?: string; message?: string };

function firstValidationMessage(errors: unknown): string | null {
  if (!errors) return null;
  if (Array.isArray(errors)) {
    const first = errors[0] as ValidationIssue | undefined;
    return first?.message?.trim() || null;
  }
  if (typeof errors === 'object') {
    const record = errors as Record<string, string[] | string>;
    for (const value of Object.values(record)) {
      if (Array.isArray(value) && value[0]) return value[0];
      if (typeof value === 'string' && value.trim()) return value.trim();
    }
  }
  return null;
}

/** Prefer field-level validation text over generic «Validation error». */
export function formatApiErrorMessage(error: Error & Partial<ApiError>): string {
  const base = error.message?.trim() || 'حدث خطأ';
  let formatted = base;

  const isGenericValidation =
    base === 'Validation error' ||
    base === 'Validation Error' ||
    base.includes('راجع الحقول المعلّمة') ||
    base.includes('راجع الخانات المعلمة') ||
    base.includes('بعض الحقول غير صحيحة');
  if (isGenericValidation) {
    const detail = firstValidationMessage(error.errors);
    if (!detail) formatted = 'يرجى التحقق من الحقول المدخلة';
    else if (/invalid email/i.test(detail)) formatted = 'البريد الإلكتروني غير صالح';
    else if (/avatar image is too large/i.test(detail))
      formatted = 'صورة الملف الشخصي كبيرة جداً — استخدم صورة أصغر من 2 ميجابايت';
    else if (/avatar must be/i.test(detail)) formatted = 'صيغة صورة الملف الشخصي غير مدعومة';
    else if (/invalid uuid|must be a valid uuid/i.test(detail)) formatted = 'قيمة غير صالحة في أحد الحقول — راجع العميل والمخزن وبنود الفاتورة';
    else if (/expected number/i.test(detail)) formatted = 'أدخل رقماً صحيحاً في الكمية أو السعر';
    else if (/required/i.test(detail)) formatted = 'أكمل الحقول المطلوبة ثم احفظ';
    else formatted = /[\u0600-\u06FF]/.test(detail) ? detail : 'راجع البيانات المدخلة ثم احفظ';
  }

  const code = error.code ?? '';
  const httpStatus = /^\d+$/.test(code) ? Number.parseInt(code, 10) : undefined;
  return localizeApiErrorMessage(formatted, httpStatus);
}
