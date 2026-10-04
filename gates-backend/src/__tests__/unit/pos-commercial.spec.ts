import { couponDiscount, countedFromDenominations, exchangeSplit, functionalTender } from '../../modules/pos/services/pos-commercial-math';

const rule = {
  isActive: true,
  validFrom: new Date('2026-01-01'),
  validTo: new Date('2027-01-01'),
  minSpend: 100,
  kind: 'PERCENT' as const,
  percent: 10,
  amount: null,
  maxUses: 2,
  usedCount: 0,
  customerId: null,
  singleUsePerCustomer: true,
};

describe('POS commercial money', () => {
  it('converts a foreign face amount with the company rate', () => {
    expect(functionalTender('usd', 10, 50)).toEqual({
      currency: 'USD',
      exchangeRate: 50,
      foreignAmount: 10,
      functionalAmount: 500,
    });
    expect(functionalTender('EGP', 18.5, 9)).toEqual({
      currency: 'EGP',
      exchangeRate: 1,
      foreignAmount: null,
      functionalAmount: 18.5,
    });
  });

  it('rejects a coupon that misses spend, customer, or remaining uses', () => {
    expect(couponDiscount(rule, 50, 'c1', false, new Date('2026-06-01')).ok).toBe(false);
    expect(couponDiscount({ ...rule, customerId: 'other' }, 200, 'c1', false, new Date('2026-06-01')).ok).toBe(false);
    expect(couponDiscount(rule, 200, 'c1', true, new Date('2026-06-01')).ok).toBe(false);
    expect(couponDiscount({ ...rule, usedCount: 2 }, 200, 'c1', false, new Date('2026-06-01')).ok).toBe(false);
    const accepted = couponDiscount(rule, 250, 'c1', false, new Date('2026-06-01'));
    expect(accepted).toEqual({ ok: true, discount: 25 });
  });

  it('clears the shared exchange amount and keeps only the difference', () => {
    expect(exchangeSplit(80, 100)).toEqual({ offset: 80, collect: 20, refund: 0 });
    expect(exchangeSplit(100, 40)).toEqual({ offset: 40, collect: 0, refund: 60 });
  });

  it('sums denomination counts into the counted cash', () => {
    expect(countedFromDenominations([{ value: 200, count: 50 }, { value: 100, count: 30 }])).toBe(13000);
  });
});
