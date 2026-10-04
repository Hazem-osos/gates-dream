import { attachStockSummaries } from '../../../src/modules/inventory/services/item-stock-summary';

describe('attachStockSummaries', () => {
  it('merges warehouse stock fields onto list rows', () => {
    const summaries = new Map([
      [
        'a',
        {
          quantityOnHand: 10,
          reservedQuantity: 4,
          availableQuantity: 6,
          onHandQuantity: 6,
        },
      ],
    ]);
    const rows = attachStockSummaries([{ id: 'a', arabicName: 'X' }], summaries);
    expect(rows[0]).toMatchObject({
      quantityOnHand: 10,
      reservedQuantity: 4,
      availableQuantity: 6,
      onHandQuantity: 6,
    });
  });
});
