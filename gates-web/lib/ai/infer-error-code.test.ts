import { describe, expect, it } from 'vitest';
import { inferBusinessErrorCode } from './infer-error-code';
import { isNegativeStockConfirmNotification } from '@/lib/api/api-error-notify';

describe('negative-stock unpost confirm is not item-card error', () => {
  it('does not map CONFIRM_NEGATIVE_STOCK_* to NEGATIVE_STOCK_ERROR', () => {
    expect(
      inferBusinessErrorCode(
        'الكمية المتاحة لا تكفي، الرصيد سيصبح بالسالب',
        'CONFIRM_NEGATIVE_STOCK_UNPOST'
      )
    ).toBe('CONFIRM_NEGATIVE_STOCK_UNPOST');
  });

  it('treats the admin-responsibility warning as confirm, not a stock failure', () => {
    const message =
      'الكمية المتاحة لا تكفي، الرصيد سيصبح بالسالب. تحذير: الرصيد سيصبح بالسالب. العملية تحت مسؤوليتك.';
    expect(inferBusinessErrorCode(message, '409')).toBe('CONFIRM_NEGATIVE_STOCK_UNPOST');
    expect(isNegativeStockConfirmNotification({ code: '409', message })).toBe(true);
    expect(isNegativeStockConfirmNotification({ code: 'CONFIRM_NEGATIVE_STOCK_POST' })).toBe(true);
  });

  it('does not open كارت الصنف for a purchase-invoice unpost shortage', () => {
    expect(
      isNegativeStockConfirmNotification({
        code: '422',
        message:
          'الكمية المتاحة لا تكفي، الرصيد سيصبح بالسالب. الصنف «حديد» في مخزن «الرئيسي». المتاح: 0 — المطلوب: 10',
        url: '/invoices/abc/unpost',
      })
    ).toBe(true);
  });
});
