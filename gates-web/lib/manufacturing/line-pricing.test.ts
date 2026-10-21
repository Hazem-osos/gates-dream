import { describe, expect, it } from 'vitest';
import {
  parseManufacturingLinePricingPolicy,
  resolveManufacturingLineUnitPrice,
} from './line-pricing';

describe('manufacturing line pricing', () => {
  it('defaults unknown values to average cost', () => {
    expect(parseManufacturingLinePricingPolicy('LAST_SALE')).toBe('AVERAGE_COST');
  });

  it('uses last purchase when chosen and falls back to average', () => {
    expect(
      resolveManufacturingLineUnitPrice('LAST_PURCHASE', {
        averageCost: 12,
        lastPurchasePrice: 18,
      })
    ).toBe(18);
    expect(
      resolveManufacturingLineUnitPrice('LAST_PURCHASE', {
        averageCost: 12,
        lastPurchasePrice: 0,
      })
    ).toBe(12);
  });

  it('uses average cost when that policy is selected', () => {
    expect(
      resolveManufacturingLineUnitPrice('AVERAGE_COST', {
        averageCost: 12,
        lastPurchasePrice: 18,
      })
    ).toBe(12);
  });

  it('does not auto-fill when pricing is manual', () => {
    expect(parseManufacturingLinePricingPolicy('MANUAL')).toBe('MANUAL');
    expect(
      resolveManufacturingLineUnitPrice('MANUAL', {
        averageCost: 12,
        lastPurchasePrice: 18,
      })
    ).toBe(0);
  });
});
