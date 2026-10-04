import {
  matchesOrderLimitStatus,
  orderLimitStatusLabel,
  resolveEffectiveOrderLimit,
} from '../../modules/inventory/services/order-limit-status';

describe('order limit status', () => {
  it('prefers a positive warehouse list limit and ignores zero overrides', () => {
    expect(resolveEffectiveOrderLimit(8, 3)).toBe(8);
    expect(resolveEffectiveOrderLimit(0, 12)).toBe(12);
    expect(resolveEffectiveOrderLimit(undefined, 5)).toBe(5);
  });

  it('keeps the reorder-point split', () => {
    expect(matchesOrderLimitStatus(10, 4, 'exceeded')).toBe(true);
    expect(matchesOrderLimitStatus(10, 10, 'exceeded')).toBe(true);
    expect(matchesOrderLimitStatus(10, 11, 'exceeded')).toBe(false);
    expect(matchesOrderLimitStatus(10, 11, 'within')).toBe(true);
    expect(matchesOrderLimitStatus(10, 4, 'within')).toBe(false);
    expect(matchesOrderLimitStatus(10, 4, 'all')).toBe(true);
    expect(matchesOrderLimitStatus(10, 20, 'all')).toBe(true);
    expect(matchesOrderLimitStatus(0, 1, 'all')).toBe(false);
    expect(matchesOrderLimitStatus(10, 4, undefined)).toBe(true);
  });

  it('labels rows that are still above the reorder point', () => {
    expect(orderLimitStatusLabel(10, 4, 0)).toBe('تحت حد الطلب');
    expect(orderLimitStatusLabel(10, 12, 0)).toBe('لم يتعد حد الطلب');
    expect(orderLimitStatusLabel(10, 30, 20)).toBe('فوق الحد الأعلى');
  });
});
