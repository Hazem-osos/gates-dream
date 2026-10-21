import { describe, expect, it } from 'vitest';
import { parseAsOfDay, pickDisplayedAverageCost } from './average-cost-as-of';
import { catalogItemForAsOfAverageCost } from './assembly-pricing';
import { applyAsOfAverageCosts, warehouseBalanceMapFromRows } from './stocktaking-balance-sync';
import { itemCostAsOfValue } from '@/lib/hooks/useItemCostAsOf';

describe('displayed average cost follows the screen date', () => {
  const today = '2026-10-19';

  it('parses document dates', () => {
    expect(parseAsOfDay('2026-10-17')).toBe('2026-10-17');
    expect(parseAsOfDay('2026-10-17T08:00:00')).toBe('2026-10-17');
    expect(parseAsOfDay('')).toBeNull();
  });

  it('keeps today\'s warehouse cost when the date is today or missing', () => {
    expect(
      pickDisplayedAverageCost({ historical: 0, current: 12, asOfDay: today, today })
    ).toBe(12);
    expect(
      pickDisplayedAverageCost({ historical: 0, current: 12, asOfDay: null, today })
    ).toBe(12);
  });

  it('uses history when the date is moved back', () => {
    expect(
      pickDisplayedAverageCost({
        historical: 9,
        current: 12,
        asOfDay: '2026-10-17',
        today,
      })
    ).toBe(9);
    expect(
      pickDisplayedAverageCost({
        historical: 0,
        current: 12,
        asOfDay: '2026-10-17',
        today,
      })
    ).toBe(0);
  });

  it('ignores catalog current MAC once a document date is set', () => {
    expect(
      catalogItemForAsOfAverageCost({ averageCost: 40, lastPurchasePrice: 30 }, '2026-10-17')
    ).toBeNull();
    expect(
      catalogItemForAsOfAverageCost({ averageCost: 40 }, undefined)?.averageCost
    ).toBe(40);
  });

  it('reads cost-as-of payload shapes', () => {
    expect(itemCostAsOfValue({ cost: 8 })).toBe(8);
    expect(itemCostAsOfValue({ unitCost: 7 })).toBe(7);
    expect(itemCostAsOfValue({ movingAverageCost: 6 })).toBe(6);
  });

  it('refreshes stocktaking MAC without changing counted qty', () => {
    const map = warehouseBalanceMapFromRows([{ itemId: 'a', quantityOnHand: 10, averageCost: 4 }]);
    const next = applyAsOfAverageCosts(
      [{ itemId: 'a', bookValue: 10, actualValue: 9, averageUnitCost: 12, unitPrice: 12 }],
      map
    );
    expect(next[0]?.bookValue).toBe(10);
    expect(next[0]?.actualValue).toBe(9);
    expect(next[0]?.averageUnitCost).toBe(4);
    expect(next[0]?.unitPrice).toBe(4);
  });
});
