import { splitLandedCostCapitalization } from '../../modules/inventory/services/landed-cost-math';

describe('splitLandedCostCapitalization', () => {
  it('sends the sold share to COGS and capitalizes the remainder (100 received, 40 on hand)', () => {
    const split = splitLandedCostCapitalization({
      allocatedCost: 1000,
      receivedQty: 100,
      onHandQty: 40,
    });

    expect(split.unitCostDelta).toBe(10);
    expect(split.soldQuantity).toBe(60);
    expect(split.capitalizeQuantity).toBe(40);
    expect(split.capitalizeAmount).toBe(400);
    expect(split.cogsTrueUpAmount).toBe(600);
  });

  it('capitalizes the full allocation when nothing has been sold', () => {
    const split = splitLandedCostCapitalization({
      allocatedCost: 250,
      receivedQty: 50,
      onHandQty: 80,
    });

    expect(split.soldQuantity).toBe(0);
    expect(split.capitalizeQuantity).toBe(50);
    expect(split.capitalizeAmount).toBe(250);
    expect(split.cogsTrueUpAmount).toBe(0);
  });

  it('posts the entire allocation to COGS when on-hand is zero', () => {
    const split = splitLandedCostCapitalization({
      allocatedCost: 180,
      receivedQty: 30,
      onHandQty: 0,
    });

    expect(split.capitalizeAmount).toBe(0);
    expect(split.cogsTrueUpAmount).toBe(180);
    expect(split.soldQuantity).toBe(30);
  });
});
