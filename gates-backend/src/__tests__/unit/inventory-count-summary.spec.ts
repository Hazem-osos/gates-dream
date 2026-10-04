import { inventoryCountSummaryTotalsFromRows } from '../../modules/inventory/services/inventory-count-report';

describe('inventoryCountSummaryTotalsFromRows', () => {
  it('sums quantity and value columns and skips group rows', () => {
    const grand = inventoryCountSummaryTotalsFromRows([
      { isGroup: true, quantityOnHand: 999 },
      { quantityOnHand: 10, reservedQuantity: 2, stockValue: 100, otherQuantity: 1 },
      { quantityOnHand: 5, reservedQuantity: 1, stockValue: 50, otherQuantity: 0.5 },
    ]);
    expect(grand.totalQuantity).toBe(15);
    expect(grand.totalValue).toBe(150);
    expect(grand.columnTotals.reservedQuantity).toBe(3);
    expect(grand.columnTotals.availableQty).toBe(12);
    expect(grand.columnTotals.otherQuantity).toBe(1.5);
  });
});
