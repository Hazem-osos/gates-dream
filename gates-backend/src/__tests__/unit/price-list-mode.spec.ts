import { applyPriceListMode, listedSaleAmount } from '../../modules/inventory/services/price-list-mode';

describe('applyPriceListMode', () => {
  it('uses the written amount when mode is value', () => {
    expect(applyPriceListMode(85, 'value', { cost: 40, lastPurchase: 50 })).toBe(85);
    expect(applyPriceListMode(85, null, { cost: 40, lastPurchase: 50 })).toBe(85);
  });

  it('treats the written number as a percent of cost', () => {
    expect(applyPriceListMode(120, 'cost', { cost: 50, lastPurchase: 80 })).toBe(60);
  });

  it('treats the written number as a percent of last purchase', () => {
    expect(applyPriceListMode(150, 'last', { cost: 50, lastPurchase: 80 })).toBe(120);
  });

  it('returns 0 when the percent base is missing', () => {
    expect(applyPriceListMode(120, 'cost', { cost: 0, lastPurchase: 80 })).toBe(0);
    expect(applyPriceListMode(120, 'last', { cost: 50, lastPurchase: 0 })).toBe(0);
  });
});

describe('listedSaleAmount', () => {
  it('prefers retailPrice then price', () => {
    expect(listedSaleAmount({ price: 10, retailPrice: 20 })).toBe(20);
    expect(listedSaleAmount({ price: 10, retailPrice: null })).toBe(10);
  });
});
