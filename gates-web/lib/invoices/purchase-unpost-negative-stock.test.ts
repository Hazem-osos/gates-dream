import { describe, expect, it, vi } from 'vitest';
import {
  CONFIRM_NEGATIVE_STOCK_POST,
  CONFIRM_NEGATIVE_STOCK_UNPOST,
  isConfirmNegativeStockUnpostError,
  retryIfNegativeStockConfirm,
} from './purchase-unpost-negative-stock';

vi.mock('@/lib/feedback/confirm', () => ({
  confirmAction: vi.fn(async () => false),
}));

describe('isConfirmNegativeStockUnpostError', () => {
  it('matches admin confirmation codes for post and unpost', () => {
    expect(isConfirmNegativeStockUnpostError({ code: CONFIRM_NEGATIVE_STOCK_UNPOST })).toBe(true);
    expect(isConfirmNegativeStockUnpostError({ code: CONFIRM_NEGATIVE_STOCK_POST })).toBe(true);
    expect(isConfirmNegativeStockUnpostError({ code: '409' })).toBe(false);
  });

  it('matches HTTP 409 when the admin-responsibility warning is in the message', () => {
    expect(
      isConfirmNegativeStockUnpostError({
        code: '409',
        message:
          'الكمية المتاحة لا تكفي، الرصيد سيصبح بالسالب. تحذير: الرصيد سيصبح بالسالب. العملية تحت مسؤوليتك.',
      })
    ).toBe(true);
  });

  it('matches a raw shortage so unpost does not open كارت الصنف', () => {
    expect(
      isConfirmNegativeStockUnpostError({
        code: '422',
        message:
          'الكمية المتاحة لا تكفي، الرصيد سيصبح بالسالب. الصنف «حديد» في مخزن «الرئيسي». المتاح: 0 — المطلوب: 10',
      })
    ).toBe(true);
  });
});

describe('retryIfNegativeStockConfirm', () => {
  it('does not retry when the confirm flag was already sent', () => {
    const retry = vi.fn();
    expect(
      retryIfNegativeStockConfirm(
        { code: CONFIRM_NEGATIVE_STOCK_UNPOST, message: 'تحذير' },
        { confirmNegativeStockUnpost: true },
        retry
      )
    ).toBe(false);
    expect(retry).not.toHaveBeenCalled();
  });

  it('handles HTTP 409 with the admin warning so confirm can complete unpost', () => {
    const retry = vi.fn();
    expect(
      retryIfNegativeStockConfirm(
        {
          code: '409',
          message:
            'الكمية المتاحة لا تكفي، الرصيد سيصبح بالسالب. تحذير: الرصيد سيصبح بالسالب. العملية تحت مسؤوليتك.',
        },
        {},
        retry
      )
    ).toBe(true);
  });
});
