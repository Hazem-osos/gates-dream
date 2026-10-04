import { computePurchaseLineNetCost } from '../../modules/invoices/services/purchase-line-net-cost';

describe('computePurchaseLineNetCost for return fallback', () => {
  it('derives unified net unit cost when unitCostAtIssue was never stored', () => {
    const { unifiedNetUnitCost } = computePurchaseLineNetCost(
      {
        total: 1000,
        discountAmount: 100,
        headerDiscountAllocated: 0,
        baseQuantity: 10,
      },
      1
    );
    expect(unifiedNetUnitCost).toBe(90);
  });
});
