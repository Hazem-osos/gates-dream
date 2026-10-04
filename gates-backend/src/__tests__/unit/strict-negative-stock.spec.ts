import {
  strictInventoryFromFlags,
  transactionEnforcesStrictNegativeStock,
} from '../../modules/inventory/services/strict-inventory';

describe('negative stock policy helpers', () => {
  it('strictInventoryFromFlags blocks when company has not opted in', () => {
    expect(
      strictInventoryFromFlags({
        allowNegativeBalance: false,
        preventNegativeStock: true,
      })
    ).toBe(true);
    expect(
      strictInventoryFromFlags({
        allowNegativeBalance: true,
        preventNegativeStock: true,
      })
    ).toBe(false);
  });

  it('transactionEnforcesStrictNegativeStock requires both prevent and affectStock', () => {
    expect(
      transactionEnforcesStrictNegativeStock({
        preventNegativeStock: true,
        affectStock: true,
      })
    ).toBe(true);
    expect(
      transactionEnforcesStrictNegativeStock({
        preventNegativeStock: true,
        affectStock: false,
      })
    ).toBe(false);
    expect(transactionEnforcesStrictNegativeStock(null)).toBe(false);
  });
});
