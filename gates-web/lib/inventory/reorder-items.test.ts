import { isAtOrderLimit, reorderPurchaseQuantity } from './reorder-items';

const item = (patch: Record<string, unknown>) => ({ id: '1', ...patch });

test('an item at or under its order limit is included', () => {
  expect(isAtOrderLimit(item({ onHandQuantity: 4, orderLimit: 10 }))).toBe(true);
  expect(isAtOrderLimit(item({ onHandQuantity: 10, orderLimit: 10 }))).toBe(true);
  expect(isAtOrderLimit(item({ onHandQuantity: 11, orderLimit: 10 }))).toBe(false);
  expect(isAtOrderLimit(item({ onHandQuantity: 0, orderLimit: 0 }))).toBe(false);
});

test('purchase quantity is the gap up to the order limit', () => {
  expect(reorderPurchaseQuantity(item({ onHandQuantity: 4, orderLimit: 10 }))).toBe(6);
  expect(reorderPurchaseQuantity(item({ onHandQuantity: 10, orderLimit: 10 }))).toBe(1);
});
