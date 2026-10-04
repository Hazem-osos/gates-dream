import { authoritativePosTotals, roundTo2 } from '../../modules/pos/utils/pos-money';

describe('POS 2dp money authority', () => {
  it('rounds half-up at the persisted 2dp scale', () => {
    expect(roundTo2(10.005)).toBe(10.01);
    expect(roundTo2(10.004)).toBe(10);
    expect(roundTo2(1.005)).toBe(1.01);
  });

  it('normalizes tax, percent discount, and net before a tender check would run', () => {
    const totals = authoritativePosTotals([
      {
        itemId: 'item',
        unitId: 'unit',
        quantity: 3,
        price: 10.3333,
        discountPercent: 10,
        taxPercent: 14,
        lineOrder: 1,
      },
    ]);
    expect(totals.netAmount).toBe(roundTo2(totals.netAmount));
    expect(totals.taxAmount).toBe(roundTo2(totals.taxAmount));
    expect(totals.discountAmount).toBe(roundTo2(totals.discountAmount));
    expect(Number.isInteger(Math.round(totals.netAmount * 100))).toBe(true);
  });

  it('uses a fixed discount when no percent is sent', () => {
    const totals = authoritativePosTotals([
      {
        itemId: 'item',
        unitId: 'unit',
        quantity: 2,
        price: 50,
        discountAmount: 5,
        taxPercent: 14,
        lineOrder: 1,
      },
    ]);
    expect(totals.discountAmount).toBe(5);
    expect(totals.totalAmount).toBe(100);
    expect(totals.taxAmount).toBe(13.3);
    expect(totals.netAmount).toBe(108.3);
  });

  it('rounds a fractional quantity at a 2dp boundary', () => {
    const totals = authoritativePosTotals([
      {
        itemId: 'item',
        unitId: 'unit',
        quantity: 0.333,
        price: 10,
        taxPercent: 14,
        lineOrder: 1,
      },
    ]);
    expect(totals.netAmount).toBe(roundTo2(totals.merchandise + totals.taxAmount));
    expect(totals.netAmount).toBe(Number(totals.netAmount.toFixed(2)));
  });

  it('accepts a tender that matches the 2dp net and not a longer preview', () => {
    const totals = authoritativePosTotals([
      {
        itemId: 'item',
        unitId: 'unit',
        quantity: 1,
        price: 10.004,
        taxPercent: 0,
        lineOrder: 1,
      },
    ]);
    const preview4 = 10.004;
    expect(Math.abs(totals.netAmount - preview4) > 0.0001).toBe(true);
    expect(Math.abs(totals.netAmount - roundTo2(preview4)) <= 0.0001).toBe(true);
    expect(totals.netAmount).toBe(10);
  });
});
