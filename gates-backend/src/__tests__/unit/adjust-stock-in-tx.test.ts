import { strictInventoryFromFlags } from '../../modules/inventory/services/strict-inventory';

describe('strictInventoryFromFlags', () => {
  it('is strict by default when no negative-stock flags are set', () => {
    expect(strictInventoryFromFlags({})).toBe(true);
    expect(strictInventoryFromFlags({ allowNegativeBalance: false })).toBe(true);
  });

  it('is not strict when CompanySettings.allowNegativeBalance is true', () => {
    expect(strictInventoryFromFlags({ allowNegativeBalance: true })).toBe(false);
  });

  it('is not strict when a legacy allow-negative flag is on', () => {
    expect(strictInventoryFromFlags({ allowNegativeStore: true })).toBe(false);
    expect(strictInventoryFromFlags({ allowMinusQty: true })).toBe(false);
  });
});
