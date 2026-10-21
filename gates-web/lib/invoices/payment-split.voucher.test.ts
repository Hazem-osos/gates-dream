import { describe, expect, it } from 'vitest';
import {
  cashTenderNeedsManualVoucherNumber,
  cashVoucherNumberRequiredMessage,
  withCopiedCashVoucherNumbers,
  type PaymentSplitLine,
} from './payment-split.types';

const SAFE = 'safe-1';

describe('cash voucher numbers on invoice splits', () => {
  it('copies the typed cash receipt number onto rebuilt treasury tenders', () => {
    const rebuilt: PaymentSplitLine[] = [
      { type: 'CASH', safeId: SAFE, amount: 40 },
      { type: 'ON_ACCOUNT', amount: 60 },
    ];
    const source: PaymentSplitLine[] = [
      { type: 'CASH', safeId: SAFE, amount: 40, voucherNumber: 'BR-12' },
      { type: 'ON_ACCOUNT', amount: 60 },
    ];
    expect(withCopiedCashVoucherNumbers(rebuilt, source)).toEqual([
      { type: 'CASH', safeId: SAFE, amount: 40, voucherNumber: 'BR-12' },
      { type: 'ON_ACCOUNT', amount: 60 },
    ]);
  });

  it('requires a number only when cash voucher numbering is manual', () => {
    const splits: PaymentSplitLine[] = [{ type: 'CASH', safeId: SAFE, amount: 40 }];
    expect(cashTenderNeedsManualVoucherNumber(splits, false)).toBe(false);
    expect(cashTenderNeedsManualVoucherNumber(splits, true)).toBe(true);
    expect(
      cashTenderNeedsManualVoucherNumber(
        [{ type: 'CASH', safeId: SAFE, amount: 40, voucherNumber: '1' }],
        true
      )
    ).toBe(false);
    expect(cashVoucherNumberRequiredMessage('RECEIPT')).toMatch(/سند القبض/);
    expect(cashVoucherNumberRequiredMessage('PAYMENT')).toMatch(/سند الصرف/);
  });
});
