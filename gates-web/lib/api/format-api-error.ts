import type { ApiError } from './types';
import { localizeApiErrorMessage } from './localize-api-error-message';

type ValidationIssue = { path?: string | Array<string | number>; message?: string };

function openingStockPathLabel(path?: string | Array<string | number>): string | null {
  const joined = Array.isArray(path) ? path.join('.') : path;
  if (!joined) return null;
  const splitMatch = joined.match(/^paymentSplits\.(\d+)\.(\w+)/);
  if (splitMatch) {
    const field =
      splitMatch[2] === 'safeId'
        ? 'الخزينة'
        : splitMatch[2] === 'bankAccountId'
          ? 'الحساب البنكي'
          : splitMatch[2] === 'amount'
            ? 'المبلغ'
            : splitMatch[2];
    return `تحصيل — ${field}`;
  }
  const match = joined.match(/^lines\.(\d+)\.(\w+)/);
  if (!match) return null;
  const row = Number(match[1]) + 1;
  const field =
    match[2] === 'itemId'
      ? 'الصنف'
      : match[2] === 'warehouseId'
        ? 'المخزن'
        : match[2] === 'quantity'
          ? 'الكمية'
          : match[2] === 'unitPrice'
            ? 'التكلفة'
            : match[2] === 'total'
              ? 'الإجمالي'
              : match[2] === 'safeId'
                ? 'الخزينة'
                : match[2] === 'bankAccountId'
                  ? 'الحساب البنكي'
                  : match[2];
  return `سطر ${row} — ${field}`;
}

function firstValidationMessage(errors: unknown): string | null {
  if (!errors) return null;
  if (Array.isArray(errors)) {
    const first = errors[0] as ValidationIssue | undefined;
    const message = first?.message?.trim() || null;
    if (!message) return null;
    const label = openingStockPathLabel(first?.path);
    return label ? `${label}: ${message}` : message;
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
