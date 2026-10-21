import { describe, expect, it } from 'vitest';
import {
  findBelowCostLine,
  isPriceBelowAverageCost,
  resolveItemCostFloor,
} from './guardrail-hints';

describe('below-cost guardrails', () => {
  it('prefers averageCost then last purchase', () => {
    expect(resolveItemCostFloor({ averageCost: 40, lastPurchasePrice: 25 })).toBe(40);
    expect(resolveItemCostFloor({ averageCost: 0, lastPurchasePrice: 25 })).toBe(25);
    expect(resolveItemCostFloor({ averageCost: 0, lastPurchasePrice: 0 })).toBe(0);
  });

  it('blocks a line priced under the item cost floor', () => {
    expect(isPriceBelowAverageCost(30, 50)).toBe(true);
    const hit = findBelowCostLine(
      [{ itemId: 'a', unitPrice: 30 }],
      [{ id: 'a', averageCost: 0, lastPurchasePrice: 40 }]
    );
    expect(hit?.itemId).toBe('a');
  });
});
