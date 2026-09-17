import { isAlreadyPostedError } from './ensure-posted-after-save';

describe('isAlreadyPostedError', () => {
  it('treats Arabic already-posted messages as success', () => {
    expect(isAlreadyPostedError(new Error('القيد مرحّل مسبقاً'))).toBe(true);
  });

  it('treats English already-posted messages as success', () => {
    expect(isAlreadyPostedError(new Error('Invoice already posted'))).toBe(true);
  });

  it('leaves other errors as failures', () => {
    expect(isAlreadyPostedError(new Error('تم الحفظ لكن تعذر ترحيل القيد'))).toBe(false);
  });
});
