import { adjustStockInTx } from '../../modules/inventory/services/adjust-stock-in-tx';

describe('adjustStockInTx', () => {
  it('reads warehouse average cost via the transaction client (not an undefined db)', async () => {
    const findUnique = jest.fn().mockResolvedValue({ averageCost: 7.5 });
    const tx = {
      $queryRaw: jest
        .fn()
        .mockResolvedValueOnce([{ quantityOnHand: 10, reservedQuantity: 0 }])
        .mockResolvedValueOnce(undefined),
      $executeRaw: jest.fn().mockResolvedValue(1),
      itemWarehouseBalance: { findUnique },
    };

    const result = await adjustStockInTx(tx as never, {
      companyId: 'c1',
      itemId: 'i1',
      warehouseId: 'w1',
      deltaQty: 2,
    });

    expect(findUnique).toHaveBeenCalled();
    expect(result.quantityOnHand).toBe(12);
    expect(result.averageCost).toBe(7.5);
  });
});
