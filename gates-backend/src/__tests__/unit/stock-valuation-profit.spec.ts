import { buildStockValuationProfit, type StockProfitItem } from '../../modules/inventory/services/stock-valuation-profit';

function item(overrides: Partial<StockProfitItem> = {}): StockProfitItem {
  return {
    id: 'a',
    serial: '1',
    arabicName: 'كابل',
    groupName: 'كهرباء',
    priceWholesale: 10,
    priceSemiWholesale: 9,
    exportPrice: 12,
    representativePrice: 8,
    priceRetail: 15,
    retailPrice: 14,
    consumerPrice: 16,
    averageCost: 4,
    units: [
      { conversionFactor: 1, isBaseUnit: true, arabicName: 'قطعة' },
      { conversionFactor: 24, isBaseUnit: false, arabicName: 'كرتونة' },
    ],
    ...overrides,
  };
}

describe('stock valuation profit', () => {
  it('values on-hand quantity at the wholesale price and converts unit 2', () => {
    const built = buildStockValuationProfit(
      [item()],
      [{ itemId: 'a', warehouseId: 'w', warehouseName: 'رئيسي', quantity: 10, averageCost: 4 }],
      { priceTier: 'wholesale', otherUnitIndex: 2, showGroups: false, showWarehouse: true }
    );
    expect(built.rows).toHaveLength(1);
    expect(built.rows[0].quantity).toBe(10);
    expect(built.rows[0].unitName).toBe('قطعة');
    expect(built.rows[0].warehouseName).toBe('رئيسي');
    expect(built.rows[0].otherQuantity).toBeCloseTo(10 / 24);
    expect(built.rows[0].saleValue).toBe(100);
    expect(built.rows[0].costValue).toBe(40);
    expect(built.rows[0].profit).toBe(60);
    expect(built.rows[0].profitPercentOnSales).toBe(60);
    expect(built.rows[0].profitPercentOnCost).toBe(150);
    expect(built.rows[0].profitPercentOnTotal).toBe(100);
    expect(built.summary.totalProfit).toBe(60);
  });

  it('drops empty stock unless requested, and can keep only negative quantities', () => {
    const items = [
      item(),
      item({ id: 'b', arabicName: 'لمبة', averageCost: 2, priceWholesale: 5 }),
    ];
    const balances = [
      { itemId: 'a', warehouseId: 'w', warehouseName: 'رئيسي', quantity: 0, averageCost: 4 },
      { itemId: 'b', warehouseId: 'w', warehouseName: 'رئيسي', quantity: -3, averageCost: 2 },
    ];
    const hidden = buildStockValuationProfit(items, balances, { showEmpty: false, showGroups: false });
    expect(hidden.rows.map((row) => row.itemId)).toEqual(['b']);

    const shown = buildStockValuationProfit(items, balances, { showEmpty: true, showGroups: false, negativeOnly: true });
    expect(shown.rows.map((row) => row.itemId)).toEqual(['b']);
  });

  it('keeps a row per warehouse and divides money by the currency rate', () => {
    const built = buildStockValuationProfit(
      [item()],
      [
        { itemId: 'a', warehouseId: 'w1', warehouseName: 'أ', quantity: 4, averageCost: 2 },
        { itemId: 'a', warehouseId: 'w2', warehouseName: 'ب', quantity: 6, averageCost: 4 },
      ],
      { showWarehouse: false, showGroups: false, exchangeRate: 2, priceTier: 'consumer' }
    );
    expect(built.rows).toHaveLength(2);
    expect(built.rows.map((row) => row.warehouseName).sort()).toEqual(['أ', 'ب']);
    expect(built.rows.reduce((sum, row) => sum + Number(row.quantity), 0)).toBe(10);
    expect(built.rows.every((row) => row.salePrice === 8)).toBe(true);
    expect(built.summary.totalProfit).toBeCloseTo((160 - 32) / 2);
  });

  it('keeps one item row so a group or warehouse header can wrap it later', () => {
    const built = buildStockValuationProfit(
      [item()],
      [{ itemId: 'a', warehouseId: 'w', warehouseName: 'رئيسي', quantity: 2, averageCost: 4 }],
      { showGroups: true, showWarehouse: true }
    );
    expect(built.rows.map((row) => row.itemName)).toEqual(['كابل']);
    expect(built.rows[0].groupName).toBe('كهرباء');
    expect(built.rows[0].warehouseName).toBe('رئيسي');
    expect(built.rows[0].profit).toBe(12);
    expect(built.summary.totalProfit).toBe(12);
  });

  it('uses the selected sale price, and sale value is quantity times that price', () => {
    const built = buildStockValuationProfit(
      [item({ salePrice: 20 })],
      [{ itemId: 'a', warehouseId: 'w', warehouseName: 'رئيسي', quantity: 3, averageCost: 5 }],
      { priceTier: 'wholesale' }
    );
    expect(built.rows[0].salePrice).toBe(20);
    expect(built.rows[0].saleValue).toBe(60);
    expect(built.rows[0].unitCost).toBe(5);
    expect(built.rows[0].costValue).toBe(15);
    expect(built.rows[0].profit).toBe(45);
  });
});
