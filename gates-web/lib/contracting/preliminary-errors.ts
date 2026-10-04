import type { ApiError } from '@/lib/api/types';

/** Map backend contracting/preliminary errors to Arabic UX messages. */
export function translatePreliminaryError(error: unknown): string {
  const msg =
    error && typeof error === 'object' && 'message' in error
      ? String((error as ApiError).message)
      : error instanceof Error
        ? error.message
        : 'حدث خطأ غير متوقع';

  if (msg.includes('CLIENT_BOQ_LIMIT_EXCEEDED') || msg.includes('BoqLimitExceeded')) {
    return 'الكمية التراكمية تتجاوز كمية العقد المتاحة.';
  }
  if (msg.includes('measurement') && msg.includes('مستخدم')) {
    return 'دفتر الحصر مستخدم في مستخلص ابتدائي آخر.';
  }
  if (msg.includes('دفتر الحصر غير معتمد')) {
    return 'دفتر الحصر غير معتمد من الاستشاري.';
  }
  if (msg.includes('دفتر الحصر مرتبط بمستخلص مالي')) {
    return 'دفتر الحصر مرتبط بالفعل بمستخلص مالي.';
  }
  if (msg.includes('لا يمكن تعديل') || msg.includes('IMMUTABLE')) {
    return 'لا يمكن تعديل المستخلص في هذه الحالة.';
  }
  if (msg.includes('انتقال غير مسموح') || msg.includes('StateError')) {
    return 'الإجراء غير متاح لحالة المستخلص الحالية.';
  }
  if (msg.includes('يجب اعتماد') || msg.includes('APPROVED')) {
    return 'يجب اعتماد المستخلص قبل التحويل.';
  }
  if (msg.includes('CONVERTED') || msg.includes('converted')) {
    return 'تم تحويل هذا المستخلص مسبقاً.';
  }
  if (msg.includes('IDEMPOTENCY') || msg.includes('idempotency')) {
    return 'تعارض في مفتاح التكرار — أعد المحاولة.';
  }
  if (msg.includes('negative') || msg.includes('سالب')) {
    return 'الكمية لا يمكن أن تكون سالبة.';
  }
  if (msg.includes('not on this project') || msg.includes('BOQ item')) {
    return 'البند لا ينتمي لهذا العقد أو المشروع.';
  }
  if (msg.includes('Duplicate')) {
    return 'تكرار بند في المستخلص.';
  }

  return msg;
}
