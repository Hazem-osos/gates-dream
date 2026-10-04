import {
  buildItemMovementSheet,
  expandTreeIds,
  isInvoiceStockMovement,
  type ItemMovementSourceLine,
} from '../../modules/inventory/services/item-movement-report';

function line(partial: Partial<ItemMovementSourceLine> & Pick<ItemMovementSourceLine, 'side' | 'quantity'>): ItemMovementSourceLine {
  return {
    date: new Date('2026-11-26T00:00:00.000Z'),
    sourceLabel: 'فاتورة مشتريات',
    sourceNumber: '1',
    itemId: 'item-1',
    itemName: 'كابل',
    warehouseId: 'wh-1',
    warehouseName: 'المخزن الرئيسي',
    partyName: 'محمد الخليل',
    description: '',
    unitName: 'عدد',
    price: 0,
    total: 0,
    itemGroupName: '',
    color: '',
    origin: '',
    quality: '',
    size: '',
    upperLimit: 0,
    costCenterName: '',
    discountPercent: 0,
    discountAmount: 0,
    taxPercent: 0,
    taxAmount: 0,
    expiryDate: null,
    delegateName: '',
    priceKind: 'none',
    sourceDocumentId: '',
    sourceType: '',
    averageCost: 0,
    itemSerial: '',
    barcode: '',
    manufacturer: '',
    property1: '',
    property2: '',
    property3: '',
    property4: '',
    property5: '',
    lowerLimit: 0,
    orderLimit: 0,
    ...partial,
  };
}

describe('item movement sheet', () => {
  it('expands a header warehouse to its posting children', () => {
    const ids = expandTreeIds('header', [
      { id: 'header', parentId: null },
      { id: 'child', parentId: 'header' },
      { id: 'grand', parentId: 'child' },
      { id: 'other', parentId: null },
    ]);
    expect(ids.sort()).toEqual(['child', 'grand', 'header']);
  });

  it('treats posted invoice stock rows as already shown by the invoice line', () => {
    expect(isInvoiceStockMovement('SI')).toBe(true);
    expect(isInvoiceStockMovement('PI-UNPOST')).toBe(true);
    expect(isInvoiceStockMovement('GR')).toBe(false);
    expect(isInvoiceStockMovement(null)).toBe(false);
  });

  it('puts opening stock in the inbound columns and keeps the running balance', () => {
    const built = buildItemMovementSheet([
      line({
        side: 'opening',
        quantity: 100,
        price: 4,
        total: 400,
        averageCost: 4,
        sourceLabel: 'بضاعة أول المدة',
        sourceNumber: '',
      }),
      line({
        side: 'in',
        quantity: 50,
        price: 80,
        total: 4000,
        discountAmount: 10,
        priceKind: 'purchase',
        sourceNumber: '2',
        date: new Date('2026-11-26T00:00:00.000Z'),
      }),
      line({
        side: 'out',
        quantity: 20,
        price: 100,
        total: 2000,
        discountAmount: 5,
        priceKind: 'sale',
        sourceLabel: 'فاتورة مبيعات',
        sourceNumber: '9',
        date: new Date('2026-11-27T00:00:00.000Z'),
      }),
    ]);

    expect(built.rows.map((row) => row.balance)).toEqual([100, 150, 130]);
    expect(built.rows[0].inQty).toBe(100);
    expect(built.rows[0].inTotal).toBe(400);
    expect(built.rows[0].averageCost).toBe(4);
    expect(built.rows[0].outQty).toBeNull();
    expect(built.rows[1].inQty).toBe(50);
    expect(built.rows[1].outQty).toBeNull();
    expect(built.rows[2].outQty).toBe(20);
    expect(built.rows[0].itemName).toBe('كابل');
    expect(built.rows[0].warehouseName).toBe('المخزن الرئيسي');
    expect(built.rows[1].minPurchasePrice).toBe(80);
    expect(built.rows[2].avgSalePrice).toBe(100);
    expect(built.summary).toEqual({
      totalInQty: 150,
      totalInAmount: 4400,
      totalOutQty: 20,
      totalOutAmount: 2000,
      totalDiscount: 15,
      qtyDifference: 130,
    });
  });

  it('shows a negative opening quantity in the outbound columns', () => {
    const built = buildItemMovementSheet([
      line({
        side: 'opening',
        quantity: -5,
        price: 2,
        total: -10,
        sourceLabel: 'بضاعة أول المدة',
      }),
    ]);
    expect(built.rows[0].inQty).toBeNull();
    expect(built.rows[0].outQty).toBe(5);
    expect(built.rows[0].outTotal).toBe(10);
    expect(built.rows[0].balance).toBe(-5);
    expect(built.summary.totalOutQty).toBe(5);
    expect(built.summary.totalInQty).toBe(0);
  });

  it('counts a sales return as inbound and a purchase return as outbound', () => {
    const built = buildItemMovementSheet([
      line({ side: 'in', quantity: 4, price: 10, total: 40, sourceLabel: 'مردودات مبيعات', priceKind: 'sale' }),
      line({ side: 'out', quantity: 1, price: 10, total: 10, sourceLabel: 'مردودات مشتريات', priceKind: 'purchase' }),
    ]);
    expect(built.rows[0].inQty).toBe(4);
    expect(built.rows[1].outQty).toBe(1);
    expect(built.rows[1].balance).toBe(3);
  });

  it('lists every item in date order unless a group-by is chosen', () => {
    const built = buildItemMovementSheet([
      line({
        side: 'in',
        quantity: 5,
        itemId: 'item-2',
        itemName: 'سلك',
        warehouseId: 'wh-2',
        warehouseName: 'المخزن الفرعي',
        sourceNumber: '2',
        date: new Date('2026-11-26T00:00:00.000Z'),
      }),
      line({
        side: 'out',
        quantity: 2,
        itemId: 'item-1',
        itemName: 'كابل',
        sourceNumber: '3',
        date: new Date('2026-11-27T00:00:00.000Z'),
      }),
      line({
        side: 'in',
        quantity: 8,
        itemId: 'item-1',
        itemName: 'كابل',
        sourceNumber: '1',
        date: new Date('2026-11-25T00:00:00.000Z'),
      }),
    ]);

    expect(built.rows.map((row) => row.sourceNumber)).toEqual(['1', '2', '3']);
    expect(built.rows.map((row) => row.groupKey)).toEqual(['', '', '']);
    expect(built.rows.map((row) => row.balance)).toEqual([8, 5, 6]);
  });

  it('groups by warehouse or item group only when that layout is requested', () => {
    const lines = [
      line({
        side: 'in',
        quantity: 4,
        itemId: 'item-2',
        itemName: 'سلك',
        itemGroupName: 'كهرباء',
        warehouseId: 'wh-2',
        warehouseName: 'المخزن الفرعي',
        sourceNumber: '2',
      }),
      line({
        side: 'in',
        quantity: 3,
        itemGroupName: 'كهرباء',
        sourceNumber: '1',
      }),
    ];

    const byWarehouse = buildItemMovementSheet(lines, { groupBy: 'warehouse' });
    expect(byWarehouse.rows.map((row) => row.groupKey)).toEqual(['المخزن الرئيسي', 'المخزن الفرعي']);
    expect(byWarehouse.rows.map((row) => row.itemName)).toEqual(['كابل', 'سلك']);

    const byGroup = buildItemMovementSheet(lines, { groupBy: 'groups' });
    expect(byGroup.rows.map((row) => row.groupKey)).toEqual(['كهرباء', 'كهرباء']);
    expect(byGroup.rows.map((row) => row.itemName)).toEqual(['سلك', 'كابل']);
  });

  it('keeps in and out columns and a separate balance for each cost center', () => {
    const built = buildItemMovementSheet(
      [
        line({
          side: 'in',
          quantity: 10,
          price: 5,
          total: 50,
          costCenterId: 'cc-1',
          costCenterName: 'مشروع أ',
          sourceNumber: '1',
        }),
        line({
          side: 'out',
          quantity: 4,
          price: 8,
          total: 32,
          costCenterId: 'cc-2',
          costCenterName: 'مشروع ب',
          sourceLabel: 'فاتورة مبيعات',
          priceKind: 'sale',
          sourceNumber: '2',
        }),
        line({
          side: 'out',
          quantity: 3,
          price: 5,
          total: 15,
          costCenterId: 'cc-1',
          costCenterName: 'مشروع أ',
          sourceLabel: 'فاتورة مبيعات',
          priceKind: 'sale',
          sourceNumber: '3',
        }),
      ],
      { groupBy: 'costCenter' }
    );

    expect(built.rows.map((row) => row.groupKey)).toEqual([
      'cc-1|item-1|wh-1',
      'cc-1|item-1|wh-1',
      'cc-2|item-1|wh-1',
    ]);
    expect(built.rows[0].inQty).toBe(10);
    expect(built.rows[0].outQty).toBeNull();
    expect(built.rows[1].outQty).toBe(3);
    expect(built.rows[1].balance).toBe(7);
    expect(built.rows[2].inQty).toBeNull();
    expect(built.rows[2].outQty).toBe(4);
    expect(built.rows[2].balance).toBe(-4);
    expect(built.summary.totalInQty).toBe(10);
    expect(built.summary.totalOutQty).toBe(7);
  });
});
