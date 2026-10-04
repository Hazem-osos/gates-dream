import {
  applyMonthlySalesVisibility,
  buildMonthlyItemSales,
} from '../../modules/inventory/services/monthly-item-sales';

describe('monthly item sales', () => {
  it('splits each month into sales, returns, and net quantity and value', () => {
    const built = buildMonthlyItemSales([
      { itemId: 'a', itemName: 'كابل', itemSerial: '1', month: 1, quantity: 10, amount: 100, kind: 'sale' },
      { itemId: 'a', itemName: 'كابل', itemSerial: '1', month: 1, quantity: 2, amount: 20, kind: 'return' },
      { itemId: 'a', itemName: 'كابل', itemSerial: '1', month: 3, quantity: 4, amount: 80, kind: 'sale' },
      { itemId: 'b', itemName: 'لمبة', itemSerial: '', month: 12, quantity: 1, amount: 15, kind: 'sale' },
    ]);

    const cable = built.rows.find((row) => row.itemId === 'a');
    expect(cable?.itemName).toBe('1 — كابل');
    expect(cable?.m1SaleQty).toBe(10);
    expect(cable?.m1SaleAmount).toBe(100);
    expect(cable?.m1ReturnQty).toBe(2);
    expect(cable?.m1ReturnAmount).toBe(20);
    expect(cable?.m1NetQty).toBe(8);
    expect(cable?.m1NetAmount).toBe(80);
    expect(cable?.m3SaleQty).toBe(4);
    expect(cable?.m2SaleQty).toBe(0);
    expect(cable?.saleQty).toBe(14);
    expect(cable?.returnQty).toBe(2);
    expect(cable?.netQty).toBe(12);
    expect(cable?.netAmount).toBe(160);
    expect(built.summary).toEqual({
      itemCount: 2,
      saleQty: 15,
      saleAmount: 195,
      returnQty: 2,
      returnAmount: 20,
      netQty: 13,
      netAmount: 175,
    });
  });

  it('keeps an item when sales and returns cancel, and drops an item with nothing', () => {
    const built = buildMonthlyItemSales([
      { itemId: 'a', itemName: 'صنف', itemSerial: '', month: 6, quantity: 5, amount: 50, kind: 'sale' },
      { itemId: 'a', itemName: 'صنف', itemSerial: '', month: 6, quantity: 5, amount: 50, kind: 'return' },
      { itemId: 'b', itemName: 'فاضي', itemSerial: '', month: 6, quantity: 0, amount: 0, kind: 'sale' },
    ]);
    expect(built.rows).toHaveLength(1);
    expect(built.rows[0]?.netQty).toBe(0);
    expect(built.rows[0]?.saleQty).toBe(5);
    expect(built.rows[0]?.returnQty).toBe(5);
    expect(built.summary.netAmount).toBe(0);
    expect(built.summary.saleAmount).toBe(50);
  });

  it('lists group items with no sales, then hides them when إخفاء الأصناف المرصدة is on', () => {
    const built = buildMonthlyItemSales([
      { itemId: 'sold', itemName: 'مباع', itemSerial: '', month: 2, quantity: 3, amount: 30, kind: 'sale' },
      { itemId: 'returned', itemName: 'مردود', itemSerial: '', month: 2, quantity: 1, amount: 10, kind: 'return' },
    ]);
    const catalog = [
      { itemId: 'sold', itemName: 'مباع', itemSerial: '' },
      { itemId: 'returned', itemName: 'مردود', itemSerial: '' },
      { itemId: 'idle', itemName: 'مرصد', itemSerial: '' },
    ];

    const shown = applyMonthlySalesVisibility(built, { hideUnsold: false, catalog });
    expect(shown.rows.map((row) => row.itemId)).toEqual(['sold', 'returned', 'idle']);
    expect(shown.rows.find((row) => row.itemId === 'idle')?.saleQty).toBe(0);
    expect(shown.summary.itemCount).toBe(3);

    const hidden = applyMonthlySalesVisibility(built, { hideUnsold: true, catalog });
    expect(hidden.rows.map((row) => row.itemId)).toEqual(['sold']);
    expect(hidden.summary.itemCount).toBe(1);
    expect(hidden.summary.saleQty).toBe(3);
    expect(hidden.summary.returnQty).toBe(0);
  });
});
