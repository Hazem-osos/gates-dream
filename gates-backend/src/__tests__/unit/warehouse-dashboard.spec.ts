import { assembleWarehouseCompare, assembleWarehousePulse, expiryHitsFromLots } from '../../modules/inventory/services/warehouse-dashboard';

const items = [
  { id: 'item-1', serial: '1', arabicName: 'سكر', averageCost: 10, orderLimit: 5 },
  { id: 'item-2', serial: '2', arabicName: 'أرز', averageCost: 8, orderLimit: 0 },
];
const warehouses = [
  { id: 'wh-a', arabicName: 'الرئيسي' },
  { id: 'wh-b', arabicName: 'الفرع' },
];

describe('warehouse dashboards', () => {
  it('builds the pulse from posted balances and the month flow', () => {
    const pulse = assembleWarehousePulse({
      today: '2026-09-28',
      monthStart: '2026-09-01',
      balances: [
        { itemId: 'item-1', warehouseId: 'wh-a', quantity: 4, lastAt: new Date('2026-09-20') },
        { itemId: 'item-2', warehouseId: 'wh-a', quantity: -2, lastAt: new Date('2026-09-27') },
        { itemId: 'item-1', warehouseId: 'wh-b', quantity: 20, lastAt: new Date('2026-06-01') },
      ],
      items,
      warehouses,
      limitOverrides: [],
      flows: [
        { warehouseId: 'wh-a', day: '2026-09-28', inbound: 6, outbound: 1 },
        { warehouseId: 'wh-b', day: '2026-09-28', inbound: 2, outbound: 3 },
        { warehouseId: 'wh-a', day: '2026-09-02', inbound: 4, outbound: 0 },
      ],
      topMoves: [{ itemId: 'item-1', movement: 12 }],
      expiry: [
        {
          itemId: 'item-1',
          itemName: 'سكر',
          warehouseId: 'wh-a',
          warehouseName: 'الرئيسي',
          daysLeft: 10,
          quantity: 3,
          expiryDate: '2026-10-08',
        },
      ],
      transfers: [{ id: 'tr-1', serial: '9', date: '2026-09-28', fromName: 'الرئيسي', toName: 'الفرع' }],
      unpostedTransferCount: 1,
    });

    expect(pulse.totals.quantityOnHand).toBe(22);
    expect(pulse.totals.stockValue).toBe(4 * 10 + -2 * 8 + 20 * 10);
    expect(pulse.totals.belowOrderLimit).toBe(1);
    expect(pulse.totals.expiringWithin30).toBe(1);
    expect(pulse.totals.inboundToday).toBe(8);
    expect(pulse.totals.outboundToday).toBe(4);
    expect(pulse.days).toHaveLength(28);
    expect(pulse.days[27]?.stacks['wh-a']).toBe(6);
    expect(pulse.alerts.negative).toHaveLength(1);
    expect(pulse.alerts.unpostedTransferCount).toBe(1);
    expect(pulse.topItems[0]?.name).toBe('سكر');
  });

  it('compares warehouses on value, speed, and dead stock', () => {
    const compared = assembleWarehouseCompare({
      balances: [
        { itemId: 'item-1', warehouseId: 'wh-a', quantity: 10, lastAt: new Date('2026-09-20') },
        { itemId: 'item-2', warehouseId: 'wh-b', quantity: 5, lastAt: new Date('2026-01-01') },
      ],
      items,
      warehouses,
      flows: [
        { warehouseId: 'wh-a', day: '2026-09-02', inbound: 1, outbound: 4 },
        { warehouseId: 'wh-b', day: '2026-09-02', inbound: 0, outbound: 0 },
      ],
      expiry: [
        {
          itemId: 'item-2',
          itemName: 'أرز',
          warehouseId: 'wh-b',
          warehouseName: 'الفرع',
          daysLeft: 45,
          quantity: 2,
          expiryDate: '2026-11-12',
        },
      ],
      deadBefore: new Date('2026-07-01'),
    });

    const main = compared.warehouses.find((row) => row.id === 'wh-a');
    const branch = compared.warehouses.find((row) => row.id === 'wh-b');
    expect(main?.speed).toBe(0.4);
    expect(main?.deadQuantity).toBe(0);
    expect(branch?.deadQuantity).toBe(5);
    expect(branch?.deadValue).toBe(40);
    expect(compared.expiry.d60).toHaveLength(1);
    expect(compared.expiry.d30).toHaveLength(0);
  });

  it('nets an inbound lot against its outbound lot', () => {
    const hits = expiryHitsFromLots(
      [
        {
          itemId: 'item-1',
          itemName: 'سكر',
          warehouseId: 'wh-a',
          warehouseName: 'الرئيسي',
          batchNumber: 'B1',
          expiryDate: new Date('2026-10-20T00:00:00.000Z'),
          quantity: 10,
          side: 'in',
        },
        {
          itemId: 'item-1',
          itemName: 'سكر',
          warehouseId: 'wh-a',
          warehouseName: 'الرئيسي',
          batchNumber: 'B1',
          expiryDate: new Date('2026-10-20T00:00:00.000Z'),
          quantity: 4,
          side: 'out',
        },
      ],
      new Date('2026-09-28T00:00:00.000Z')
    );
    expect(hits).toHaveLength(1);
    expect(hits[0]?.quantity).toBe(6);
    expect(hits[0]?.daysLeft).toBe(22);
  });
});
