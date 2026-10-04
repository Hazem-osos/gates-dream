import { openingFiguresFromSums } from '../../modules/inventory/services/opening-stock-card';

describe('openingFiguresFromSums', () => {
  it('is empty when the item has no opening quantity', () => {
    expect(openingFiguresFromSums(null, null)).toEqual({
      beginningBalance: null,
      beginningCostPrice: null,
    });
    expect(openingFiguresFromSums(0, 0)).toEqual({
      beginningBalance: null,
      beginningCostPrice: null,
    });
  });

  it('uses the weighted unit cost of the opening lines', () => {
    expect(openingFiguresFromSums(10, 250)).toEqual({
      beginningBalance: 10,
      beginningCostPrice: 25,
    });
    expect(openingFiguresFromSums('6', '15')).toEqual({
      beginningBalance: 6,
      beginningCostPrice: 2.5,
    });
  });
});
