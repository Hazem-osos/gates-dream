import { itemProfitRatios } from '../../modules/inventory/services/item-profit-ratios';

describe('item profit ratios', () => {
  it('splits the profit ratio into sales, cost, and share of the report total', () => {
    const ratios = itemProfitRatios({ totalProfit: 25, totalSales: 100, totalCost: 75 }, 50);
    expect(ratios).toEqual({
      profitPercentOnSales: 25,
      profitPercentOnCost: 33.33,
      profitPercentOnTotal: 50,
    });
  });

  it('stays at zero when the divisor is zero', () => {
    expect(itemProfitRatios({ totalProfit: 10, totalSales: 0, totalCost: 0 }, 0)).toEqual({
      profitPercentOnSales: 0,
      profitPercentOnCost: 0,
      profitPercentOnTotal: 0,
    });
  });
});
