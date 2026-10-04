import { applyPriceListMode, priceFromListRow } from '../../modules/pos/services/pos-pricing.service';

describe('POS price list authority', () => {
  it('uses the listed retail price in value mode', () => {
    expect(
      priceFromListRow(
        {
          itemId: 'i',
          unitId: 'u',
          price: 8,
          retailPrice: 12,
          priceList: { priceMode: 'value', isActive: true },
        },
        {}
      )
    ).toBe(12);
  });

  it('applies cost mode as a percent of average cost', () => {
    expect(applyPriceListMode(150, 'cost', { averageCost: 10 })).toBe(15);
  });

  it('ignores an inactive price list', () => {
    expect(
      priceFromListRow(
        {
          itemId: 'i',
          unitId: 'u',
          price: 9,
          retailPrice: 9,
          priceList: { priceMode: 'value', isActive: false },
        },
        {}
      )
    ).toBe(0);
  });
});
