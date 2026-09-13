import {
  findBelowCostViolation,
  isSellingBelowCost,
  SELL_BELOW_COST_MESSAGE,
  type BelowCostItemFlag,
} from '../../modules/invoices/services/invoice-below-cost-math';

const ITEM_ID = 'item-1';

function flags(overrides: Partial<BelowCostItemFlag> = {}): Map<string, BelowCostItemFlag> {
  return new Map([
    [
      ITEM_ID,
      {
        id: ITEM_ID,
        noSellBelowCost: false,
        arabicName: 'صنف تجريبي',
        averageCost: 100,
        ...overrides,
      },
    ],
  ]);
}

describe('preventSellingBelowCost', () => {
  it('detects unitPrice below averageCost', () => {
    expect(isSellingBelowCost(90, 100)).toBe(true);
    expect(isSellingBelowCost(100, 100)).toBe(false);
    expect(isSellingBelowCost(110, 100)).toBe(false);
    expect(isSellingBelowCost(50, 0)).toBe(false);
  });

  it('blocks a sales line when the company-wide guard is on', () => {
    const violation = findBelowCostViolation(
      [{ itemId: ITEM_ID, price: 80, arabicName: 'صنف تجريبي' }],
      new Map([[ITEM_ID, 100]]),
      flags(),
      true
    );

    expect(violation).toEqual(
      expect.objectContaining({ itemId: ITEM_ID, price: 80, cost: 100 })
    );
    expect(SELL_BELOW_COST_MESSAGE).toContain('أقل من سعر التكلفة');
  });

  it('does not block when the company-wide guard is off and the item has no flag', () => {
    const violation = findBelowCostViolation(
      [{ itemId: ITEM_ID, price: 80 }],
      new Map([[ITEM_ID, 100]]),
      flags({ noSellBelowCost: false }),
      false
    );

    expect(violation).toBeNull();
  });

  it('still blocks a flagged item even when the company-wide guard is off', () => {
    const violation = findBelowCostViolation(
      [{ itemId: ITEM_ID, price: 80 }],
      new Map([[ITEM_ID, 100]]),
      flags({ noSellBelowCost: true }),
      false
    );

    expect(violation?.cost).toBe(100);
  });
});
