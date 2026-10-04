import { applyOrderLimitSheet, parseOrderLimitSheet } from './order-limit-sheet';

const lines = [
  {
    key: 'a',
    itemCode: 'IT-1',
    itemName: 'صنف أول',
    lowerLimit: '1',
    orderLimit: '5',
    upperLimit: '20',
  },
];

test('reads limits by the Arabic column names and ignores the warehouse balance', () => {
  const parsed = parseOrderLimitSheet([
    ['كود الصنف', 'اسم الصنف', 'رصيد المخزن', 'الحد الأدنى', 'حد الطلب', 'الحد الأعلى'],
    ['IT-1', 'صنف أول', 40, 2, 8, 30],
  ]);
  expect(parsed).toEqual([{ code: 'IT-1', name: 'صنف أول', lower: '2', order: '8', upper: '30' }]);
});

test('updates the matching item and leaves unmatched rows out', () => {
  const { next, matched, missed } = applyOrderLimitSheet(lines, [
    { code: 'IT-1', name: '', lower: '3', order: '9', upper: '' },
    { code: 'MISSING', name: 'مش موجود', lower: '1', order: '1', upper: '1' },
  ]);
  expect(matched).toBe(1);
  expect(missed).toBe(1);
  expect(next[0]).toMatchObject({ lowerLimit: '3', orderLimit: '9', upperLimit: '20' });
});
