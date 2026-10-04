import {
  countLayout,
  inventoryCountItemWhere,
  inventoryCountRow,
  keepCountBalance,
  layoutInventoryCountRows,
  orderedCountUnits,
  usesLiveWarehouseBalances,
} from '../../modules/inventory/services/inventory-count-report';

const item = {
  serial: '1',
  arabicName: 'سكر',
  barcode: '111',
  groupName: 'بقالة',
  orderLimit: 5,
  lowerLimit: 1,
  upperLimit: 20,
  salesTaxPercent: 14,
  isAssembly: false,
  isService: false,
  manufacturer: 'مصنع',
  color: '',
  origin: 'مصر',
  quality: '',
  size: '',
  property1: '',
  property2: '',
  property3: '',
  property4: '',
  property5: '',
  salePrice: 10,
  units: [
    { arabicName: 'كيلو', conversionFactor: 1, isBaseUnit: true },
    { arabicName: 'جرام', conversionFactor: 0.001, isBaseUnit: false },
    { arabicName: 'طن', conversionFactor: 1000, isBaseUnit: false },
  ],
};

describe('inventory count rows', () => {
  it('puts the base unit first and converts the selected other unit', () => {
    expect(orderedCountUnits(item.units).map((unit) => unit.arabicName)).toEqual(['كيلو', 'جرام', 'طن']);
    const row = inventoryCountRow({
      itemId: 'item-1',
      warehouseId: 'wh-1',
      warehouseName: 'الرئيسي',
      quantityOnHand: 2,
      reservedQuantity: 0.5,
      warehouseAverageCost: 4,
      itemAverageCost: 9,
      totalQuantity: 7,
      otherUnitIndex: 3,
      exchangeRate: 1,
      item,
    });
    expect(row.baseUnitName).toBe('كيلو');
    expect(row.otherUnitName).toBe('طن');
    expect(row.otherQuantity).toBe(0.002);
    expect(row.availableQty).toBe(1.5);
    expect(row.totalQuantity).toBe(7);
    expect(row.stockValue).toBe(8);
    expect(row.averageCost).toBe(4);
    expect(row.itemNature).toBe('عادي');
    expect(row.itemKind).toBe('سلعة');
    expect(row.upperLimit).toBe(20);
    expect(row.groupName).toBe('بقالة');
  });

  it('labels an assembly service item and divides money by the currency rate', () => {
    const row = inventoryCountRow({
      itemId: 'item-1',
      warehouseId: 'wh-1',
      warehouseName: '',
      quantityOnHand: 2,
      reservedQuantity: 0,
      warehouseAverageCost: 10,
      itemAverageCost: 10,
      totalQuantity: 2,
      otherUnitIndex: 1,
      exchangeRate: 2,
      item: { ...item, isAssembly: true, isService: true },
    });
    expect(row.itemNature).toBe('تجميعي');
    expect(row.itemKind).toBe('خدمة');
    expect(row.averageCost).toBe(5);
    expect(row.stockValue).toBe(10);
    expect(row.otherUnitName).toBe('كيلو');
  });

  it('keeps negative stock only when that option is on, and hides empty rows', () => {
    expect(keepCountBalance(-1, 0, { hideEmpty: false, negativeOnly: true, nonNegativeOnly: false })).toBe(true);
    expect(keepCountBalance(3, 0, { hideEmpty: false, negativeOnly: true, nonNegativeOnly: false })).toBe(false);
    expect(keepCountBalance(3, 0, { hideEmpty: false, negativeOnly: false, nonNegativeOnly: true })).toBe(true);
    expect(keepCountBalance(0, 0, { hideEmpty: true, negativeOnly: false, nonNegativeOnly: false })).toBe(false);
    expect(keepCountBalance(0, 2, { hideEmpty: true, negativeOnly: false, nonNegativeOnly: false })).toBe(true);
  });

  it('maps the item-card filters without narrowing when they are off', () => {
    expect(inventoryCountItemWhere({})).toEqual({});
    expect(inventoryCountItemWhere({ activeOnly: 'true', manufacturerId: ' مصر ' })).toEqual({
      isActive: true,
      inactiveItem: false,
      manufacturerId: { contains: 'مصر' },
    });
    expect(inventoryCountItemWhere({ inactiveOnly: 'true', activeOnly: 'true' })).toEqual({});
  });

  it('puts a warehouse header above that warehouse and stays flat when neither layout is on', () => {
    expect(countLayout(false, false)).toBe('flat');
    expect(countLayout(true, false)).toBe('group');
    expect(countLayout(false, true)).toBe('warehouse');
    const rows = [
      { itemName: 'سكر', itemSerial: '2', groupName: 'بقالة', warehouseName: 'فرع' },
      { itemName: 'أرز', itemSerial: '1', groupName: 'بقالة', warehouseName: 'رئيسي' },
      { itemName: 'شاي', itemSerial: '3', groupName: 'مشروبات', warehouseName: 'رئيسي' },
    ];
    expect(layoutInventoryCountRows(rows, 'flat').map((row) => row.itemName)).toEqual(['أرز', 'سكر', 'شاي']);
    expect(layoutInventoryCountRows(rows, 'flat').every((row) => !row.accountPath)).toBe(true);
    const byWarehouse = layoutInventoryCountRows(rows, 'warehouse');
    expect(byWarehouse.map((row) => [row.accountPath, row.itemName])).toEqual([
      ['رئيسي', 'أرز'],
      ['رئيسي', 'شاي'],
      ['فرع', 'سكر'],
    ]);
    const byGroup = layoutInventoryCountRows(rows, 'group');
    expect(byGroup.map((row) => [row.accountPath, row.itemName])).toEqual([
      ['بقالة', 'أرز'],
      ['بقالة', 'سكر'],
      ['مشروبات', 'شاي'],
    ]);
    const byItemGroupName = layoutInventoryCountRows(
      [{ itemName: 'كابل', itemSerial: '4', itemGroupName: 'كهرباء', warehouseName: 'رئيسي' }],
      'group'
    );
    expect(byItemGroupName[0].accountPath).toBe('كهرباء');
  });
});

describe('usesLiveWarehouseBalances', () => {
  const now = new Date('2026-10-01T12:00:00.000Z');

  it('treats today and future as-of dates as live balances', () => {
    expect(usesLiveWarehouseBalances(new Date('2026-10-01T23:59:59.000Z'), now)).toBe(true);
    expect(usesLiveWarehouseBalances(new Date('2026-12-31T23:59:59.000Z'), now)).toBe(true);
    expect(usesLiveWarehouseBalances(undefined, now)).toBe(true);
  });

  it('treats past as-of dates as historical movement snapshot', () => {
    expect(usesLiveWarehouseBalances(new Date('2026-09-30T23:59:59.000Z'), now)).toBe(false);
  });
});
