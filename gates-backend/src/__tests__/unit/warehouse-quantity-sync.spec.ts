import {
  assertLedgerMatchesWarehouseBalanceInTx,
  syncItemQuantityToWarehouseBalanceInTx,
} from '../../modules/inventory/services/warehouse-quantity-sync';

describe('warehouse quantity sync', () => {
  it('accepts when ledger sum matches warehouse on-hand', async () => {
    const tx = {
      inventoryMovement: {
        aggregate: async () => ({ _sum: { quantityDelta: { toNumber: () => 12 } } }),
      },
    };
    await expect(
      assertLedgerMatchesWarehouseBalanceInTx(tx as never, 'co', 'item', 'wh', 12)
    ).resolves.toBeUndefined();
  });

  it('rejects when ledger and warehouse balance diverge', async () => {
    const tx = {
      inventoryMovement: {
        aggregate: async () => ({ _sum: { quantityDelta: { toNumber: () => 5 } } }),
      },
    };
    await expect(
      assertLedgerMatchesWarehouseBalanceInTx(tx as never, 'co', 'item', 'wh', 10)
    ).rejects.toThrow('تعارض داخلي');
  });

  it('sets the single unlocated row to the warehouse on-hand', async () => {
    const updates: number[] = [];
    const tx = {
      warehouse: { findFirst: async () => ({ id: 'wh' }) },
      itemQuantity: {
        findMany: async () => [{ id: 'iq-1', locationId: null, quantity: { toNumber: () => 3 } }],
        update: async ({ data }: { data: { quantity: { toNumber: () => number } } }) => {
          updates.push(data.quantity.toNumber());
        },
      },
    };
    await syncItemQuantityToWarehouseBalanceInTx(tx as never, 'co', 'item', 'wh', 12);
    expect(updates).toEqual([12]);
  });
});
