import { describe, expect, it } from 'vitest';
import {
  applyLiveBookBalances,
  diffBookFromWarehouse,
  warehouseBalanceMapFromRows,
} from '@/lib/inventory/stocktaking-balance-sync';

describe('stocktaking-balance-sync', () => {
  it('detects book drift from warehouse', () => {
    const map = warehouseBalanceMapFromRows([
      { itemId: 'a', quantityOnHand: 10 },
      { itemId: 'b', quantityOnHand: 3 },
    ]);
    const drifts = diffBookFromWarehouse(
      [
        { itemId: 'a', bookValue: 8, actualValue: 8, averageUnitCost: 1, unitPrice: 1 },
        { itemId: 'b', bookValue: 3, actualValue: 5, averageUnitCost: 1, unitPrice: 1 },
      ],
      map
    );
    expect(drifts).toHaveLength(1);
    expect(drifts[0]?.itemId).toBe('a');
  });

  it('updates book and recalculates surplus while keeping actual', () => {
    const map = warehouseBalanceMapFromRows([{ itemId: 'a', quantityOnHand: 10, averageCost: 2 }]);
    const { lines, updatedCount } = applyLiveBookBalances(
      [
        {
          itemId: 'a',
          bookValue: 7,
          actualValue: 12,
          averageUnitCost: 1,
          unitPrice: 1,
          shortage: 0,
          surplus: 5,
        },
      ],
      map,
      { keepActual: true }
    );
    expect(updatedCount).toBe(1);
    expect(lines[0]?.bookValue).toBe(10);
    expect(lines[0]?.actualValue).toBe(12);
    expect(lines[0]?.surplus).toBe(2);
  });
});
