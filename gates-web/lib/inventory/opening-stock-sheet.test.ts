import { applyOpeningStockSheet, parseOpeningStockSheet } from './opening-stock-sheet';

test('reads opening-stock columns and skips the row number and line total', () => {
  const parsed = parseOpeningStockSheet([
    ['#', 'كود الصنف', 'اسم الصنف', 'الوحدة', 'المخزن', 'كمية أول المدة', 'تكلفة الوحدة', 'إجمالي القيمة', 'رقم التشغيلة', 'تاريخ الصلاحية'],
    [1, 'IT-1', 'صنف أول', 'قطعة', 'الرئيسي', 10, 4.5, 45, 'B1', '2027-01-31'],
  ]);
  expect(parsed).toEqual([
    {
      code: 'IT-1',
      name: 'صنف أول',
      unit: 'قطعة',
      warehouse: 'الرئيسي',
      quantity: '10',
      unitCost: '4.5',
      batch: 'B1',
      expiry: '2027-01-31',
    },
  ]);
});

test('adds a matched item and leaves unknown codes out', () => {
  const { next, matched, missed } = applyOpeningStockSheet({
    lines: [],
    rows: [
      { code: 'IT-1', name: '', unit: '', warehouse: 'الرئيسي', quantity: '10', unitCost: '4', batch: '', expiry: '' },
      { code: 'NOPE', name: '', unit: '', warehouse: '', quantity: '1', unitCost: '1', batch: '', expiry: '' },
    ],
    items: [{ id: 'a', code: 'IT-1', serial: null, name: 'صنف أول', unitName: 'قطعة', averageCost: 2 }],
    warehouses: [{ id: 'w1', code: 'WH', name: 'الرئيسي' }],
    defaultWarehouseId: 'w1',
  });
  expect(matched).toBe(1);
  expect(missed).toBe(1);
  expect(next).toEqual([
    {
      itemId: 'a',
      itemCode: 'IT-1',
      itemName: 'صنف أول',
      unitName: 'قطعة',
      warehouseId: 'w1',
      quantity: 10,
      unitCost: 4,
      batchNumber: '',
      expiryDate: '',
    },
  ]);
});

test('updates the line already on the document and keeps a blank quantity', () => {
  const { next, matched } = applyOpeningStockSheet({
    lines: [
      {
        itemId: 'a',
        itemCode: 'IT-1',
        itemName: 'صنف أول',
        unitName: 'قطعة',
        warehouseId: 'w1',
        quantity: 3,
        unitCost: 2,
        batchNumber: '',
        expiryDate: '',
      },
    ],
    rows: [
      { code: 'IT-1', name: '', unit: '', warehouse: '', quantity: '', unitCost: '9', batch: '', expiry: '' },
    ],
    items: [],
    warehouses: [],
    defaultWarehouseId: '',
  });
  expect(matched).toBe(1);
  expect(next).toHaveLength(1);
  expect(next[0].quantity).toBe(3);
  expect(next[0].unitCost).toBe(9);
  expect(next[0].warehouseId).toBe('w1');
});
