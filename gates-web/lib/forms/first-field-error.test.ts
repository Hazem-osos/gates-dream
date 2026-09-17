import { firstFieldError } from './first-field-error';

describe('firstFieldError', () => {
  it('reads a nested line account message', () => {
    expect(
      firstFieldError({
        lines: {
          1: {
            accountId: { type: 'too_small', message: 'يجب اختيار الحساب', ref: { nodeType: 1 } },
          },
        },
      } as never)
    ).toBe('يجب اختيار الحساب');
  });

  it('does not walk a DOM-like ref', () => {
    const cyclic = { nodeType: 1, parentNode: null as unknown };
    (cyclic as { parentNode: unknown }).parentNode = cyclic;
    expect(
      firstFieldError({
        accountId: { type: 'required', message: 'اختر الحساب', ref: cyclic },
      } as never)
    ).toBe('اختر الحساب');
  });
});
