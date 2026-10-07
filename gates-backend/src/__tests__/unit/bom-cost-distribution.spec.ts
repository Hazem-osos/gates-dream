import {
  computeManufacturingCostPool,
  computeRawMaterialsTotal,
  distributeOutputLineCosts,
} from '../../modules/manufacturing/utils/bom-cost-distribution';

describe('bom-cost-distribution', () => {
  it('splits full general pool by cost percent then divides by quantity', () => {
    const rawLines = [{ quantity: 10, scrapPercentage: 0, unitPrice: 5 }];
    const rawTotal = computeRawMaterialsTotal(rawLines);
    expect(rawTotal).toBe(50);

    const distributed = distributeOutputLineCosts({
      labor: 10,
      overhead: 40,
      outputLines: [
        { itemId: 'a', quantity: 10, costPercent: 60 },
        { itemId: 'b', quantity: 5, costPercent: 40 },
      ],
      rawLines,
      additionalLines: [],
      distributeCostByUnits: false,
    });

    expect(computeManufacturingCostPool({ rawMaterialsTotal: 50, labor: 10, overhead: 40, additionalTotal: 0 })).toBe(
      100
    );
    expect(distributed[0]!.lineTotal).toBe(60);
    expect(distributed[0]!.unitPrice).toBe(6);
    expect(distributed[1]!.lineTotal).toBe(40);
    expect(distributed[1]!.unitPrice).toBe(8);
  });

  it('includes scrap in raw materials total', () => {
    const total = computeRawMaterialsTotal([
      { quantity: 10, scrapPercentage: 10, unitPrice: 2 },
    ]);
    expect(total).toBe(22);
  });

  it('by-units: splits general raw + additional by output quantity', () => {
    const distributed = distributeOutputLineCosts({
      labor: 50,
      overhead: 0,
      outputLines: [
        { itemId: 'a', quantity: 10, costPercent: 0 },
        { itemId: 'b', quantity: 5, costPercent: 0 },
      ],
      rawLines: [{ quantity: 1, scrapPercentage: 0, unitPrice: 80 }],
      additionalLines: [{ value: 20 }],
      distributeCostByUnits: true,
    });

    expect(distributed[0]!.sharedCost).toBe(66.6667);
    expect(distributed[0]!.directCost).toBe(0);
    expect(distributed[0]!.unitPrice).toBe(6.6667);
    expect(distributed[1]!.sharedCost).toBe(33.3333);
  });

  it('assigns targeted raw and additional cost to one output only', () => {
    const distributed = distributeOutputLineCosts({
      labor: 0,
      overhead: 0,
      outputLines: [
        { itemId: 'a', quantity: 10, costPercent: 50 },
        { itemId: 'b', quantity: 10, costPercent: 50 },
      ],
      rawLines: [
        { quantity: 1, scrapPercentage: 0, unitPrice: 30, manufacturedItemId: 'a' },
        { quantity: 1, scrapPercentage: 0, unitPrice: 10 },
      ],
      additionalLines: [{ value: 5, manufacturedItemId: 'b' }],
      distributeCostByUnits: false,
    });

    expect(distributed[0]!.directCost).toBe(30);
    expect(distributed[1]!.directCost).toBe(5);
    expect(distributed[0]!.sharedCost).toBe(5);
    expect(distributed[1]!.sharedCost).toBe(5);
    expect(distributed[0]!.lineTotal).toBe(35);
    expect(distributed[1]!.lineTotal).toBe(10);
  });
});
