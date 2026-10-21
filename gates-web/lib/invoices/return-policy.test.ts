import { describe, expect, it } from 'vitest';
import { invoiceReturnBlockReason } from './return-policy';

describe('invoiceReturnBlockReason', () => {
  it('allows a legacy sales invoice that never stored the return flag', () => {
    expect(
      invoiceReturnBlockReason({
        allowReturn: false,
        returnDays: null,
        date: new Date(),
        invoiceNumber: '00000005',
      })
    ).toBeNull();
  });

  it('blocks only when returns were turned off with 0 days', () => {
    expect(
      invoiceReturnBlockReason({
        allowReturn: false,
        returnDays: 0,
        date: new Date(),
        invoiceNumber: '00000005',
      })
    ).toBe('فاتورة 00000005 غير مسموح بإرجاعها أو عمل مردود عليها');
  });

  it('allows when السماح بالإرجاع is on', () => {
    expect(
      invoiceReturnBlockReason({
        allowReturn: true,
        returnDays: 365,
        date: new Date(),
        invoiceNumber: '00000005',
      })
    ).toBeNull();
  });
});
