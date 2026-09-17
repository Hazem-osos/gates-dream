import { isOptimisticLockApiError, isVersionConflictError } from './version-conflict';

describe('version conflict detection', () => {
  it('treats a real concurrent save as a version conflict', () => {
    expect(
      isVersionConflictError({
        httpStatus: 409,
        message:
          'تعذر الحفظ: قام مستخدم آخر بتعديل هذا المستند منذ لحظات. يرجى تحديث الصفحة لمشاهدة التعديلات الأخيرة قبل الحفظ مجدداً.',
      })
    ).toBe(true);
  });

  it('does not treat a missing related record as a colleague lock', () => {
    expect(
      isOptimisticLockApiError({
        code: '409',
        message:
          'تعذّر الحفظ لأن بياناً مرتبطاً غير موجود. الحل: تأكد أن الحساب أو الصنف أو المخزن المختار ما زال موجوداً.',
      })
    ).toBe(false);
  });

  it('does not treat document occupancy as a version conflict', () => {
    expect(
      isVersionConflictError({
        httpStatus: 409,
        code: 'DOCUMENT_OCCUPIED',
        message: 'السند مفتوح حالياً عند أحمد',
      })
    ).toBe(false);
  });
});
