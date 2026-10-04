import {
  combinedPriceListDiscountPercent,
  resolveUnitPriceFromPriceListRow,
} from '../../modules/inventory/services/party-price-list-pricing';

describe('party price list pricing', () => {
  it('uses purchase price for purchase kind', () => {
    const unit = resolveUnitPriceFromPriceListRow(
      'purchase',
      { purchasePrice: 80, price: 100, priceList: { priceMode: 'value' } },
      { cost: 50, lastPurchase: 60 }
    );
    expect(unit).toBe(80);
  });

  it('uses retail for sale kind', () => {
    const unit = resolveUnitPriceFromPriceListRow(
      'sale',
      { retailPrice: 120, purchasePrice: 80, priceList: { priceMode: 'value' } },
      { cost: 50, lastPurchase: 60 }
    );
    expect(unit).toBe(120);
  });

  it('sums line, list header, and party discounts', () => {
    expect(
      combinedPriceListDiscountPercent({
        lineDiscount: 2,
        listDiscountPercentage: 3,
        partyDiscountRaw: '5',
      })
    ).toBe(10);
  });
});
