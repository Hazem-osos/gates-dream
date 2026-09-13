import { computePurchaseLineNetCost } from '../../modules/invoices/services/purchase-line-net-cost';

describe('computePurchaseLineNetCost', () => {
  it('strips line + header discount and converts to base-currency unit cost', () => {
    const result = computePurchaseLineNetCost(
      {
        total: 1000,
        discountAmount: 100,
        headerDiscountAllocated: 50,
        baseQuantity: 10,
      },
      1
    );

    expect(result.lineNetDoc).toBe(850);
    expect(result.lineNetTotalBase).toBe(850);
    expect(result.unifiedNetUnitCost).toBe(85);
  });

  it('applies FX after discounts so MAC and GL share one net unit cost', () => {
    const result = computePurchaseLineNetCost(
      {
        total: 200,
        discountAmount: 20,
        headerDiscountAllocated: 0,
        quantity: 10,
        baseQuantity: 10,
      },
      1.5
    );

    expect(result.lineNetDoc).toBe(180);
    expect(result.lineNetTotalBase).toBe(270);
    expect(result.unifiedNetUnitCost).toBe(27);
  });

  it('prefers baseQuantity over document quantity for the inbound unit', () => {
    const result = computePurchaseLineNetCost(
      {
        total: 90,
        discountAmount: 0,
        quantity: 1,
        baseQuantity: 10,
      },
      1
    );

    expect(result.unifiedNetUnitCost).toBe(9);
  });
});
