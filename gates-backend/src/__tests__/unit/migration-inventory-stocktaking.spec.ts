import { loadPostedStoreCheckDetailLines } from '../../modules/migration-engine/services/legacy-inventory-data.service';

describe('store check/adjust movement loaders', () => {
  it('computes stocktake variance as actual minus book', async () => {
    const adapter = {
      querySql: async () => [
        {
          YearID: '2024',
          BranchCode: '01',
          Type: 'SK01',
          StoreCheckCode: '100',
          Date: new Date('2024-06-01'),
          Status: 'Post',
          Deleted: '',
          GLNum: '500',
          StoreCode: 'WH1',
          ItemCode: 'IT1',
          Qty: 10,
          ActualQty: 8,
          UnitCode: 'U1',
          Price: 5,
        },
      ],
    };
    const rows = await loadPostedStoreCheckDetailLines(adapter as never, 'C1');
    expect(rows).toHaveLength(1);
    expect(rows[0].family).toBe('SK');
    expect(rows[0].qty).toBe(-2);
  });
});
