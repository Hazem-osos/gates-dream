import { buildItemsAnalyticalMovement } from '../../modules/inventory/services/items-analytical-movement';

const delegates = [
  { id: 'kashaf', name: 'كشاف' },
  { id: 'yad', name: 'يد' },
  { id: 'kafr', name: 'كفر 12 متر' },
];

describe('items analytical movement on representatives', () => {
  it('pivots items into delegate quantity and value columns and totals each column', () => {
    const built = buildItemsAnalyticalMovement(
      [
        {
          itemId: '1',
          itemSerial: '1',
          itemName: 'صنف 1',
          delegateId: 'kashaf',
          delegateName: 'كشاف',
          quantity: 20,
          amount: 244377.1,
        },
        {
          itemId: '2',
          itemSerial: '2',
          itemName: 'محمد',
          delegateId: 'kashaf',
          delegateName: 'كشاف',
          quantity: 10,
          amount: 100,
        },
        {
          itemId: '2',
          itemSerial: '2',
          itemName: 'محمد',
          delegateId: 'kashaf',
          delegateName: 'كشاف',
          quantity: 1,
          amount: 50,
        },
      ],
      delegates
    );

    const names = built.summary.delegates.map((column) => column.name);
    expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b, 'ar')));
    expect(names).toEqual(expect.arrayContaining(['كشاف', 'يد', 'كفر 12 متر']));
    expect(built.rows).toHaveLength(2);

    const first = built.rows[0];
    expect(first.itemSerial).toBe('1');
    expect(first.itemName).toBe('صنف 1');
    expect(first.cells.kashaf).toEqual({ quantity: 20, amount: 244377.1 });
    expect(first.cells.yad).toEqual({ quantity: 0, amount: 0 });
    expect(first.cells.kafr).toEqual({ quantity: 0, amount: 0 });

    expect(built.rows[1].cells.kashaf).toEqual({ quantity: 11, amount: 150 });
    expect(built.summary.totals.kashaf).toEqual({ quantity: 31, amount: 244527.1 });
    expect(built.summary.totals.yad).toEqual({ quantity: 0, amount: 0 });
    expect(built.summary.itemCount).toBe(2);
  });

  it('keeps a sale with no delegate in its own column and drops an item that nets to zero', () => {
    const built = buildItemsAnalyticalMovement(
      [
        {
          itemId: '1',
          itemSerial: '9',
          itemName: 'بدون',
          delegateId: 'none',
          delegateName: '',
          quantity: 3,
          amount: 30,
        },
        {
          itemId: '2',
          itemSerial: '8',
          itemName: 'ملغي',
          delegateId: 'kashaf',
          delegateName: 'كشاف',
          quantity: 4,
          amount: 40,
        },
        {
          itemId: '2',
          itemSerial: '8',
          itemName: 'ملغي',
          delegateId: 'kashaf',
          delegateName: 'كشاف',
          quantity: -4,
          amount: -40,
        },
      ],
      delegates
    );

    expect(built.rows.map((row) => row.itemId)).toEqual(['1']);
    const ids = built.summary.delegates.map((column) => column.id);
    expect(ids.at(-1)).toBe('none');
    expect(ids.slice(0, -1).sort()).toEqual(['kafr', 'kashaf', 'yad']);
    expect(built.rows[0].cells.none).toEqual({ quantity: 3, amount: 30 });
    expect(built.summary.totals.none).toEqual({ quantity: 3, amount: 30 });
  });
});
