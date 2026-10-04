import {
  allocateHeaderWithholding,
  etaCommercialDiscount,
  etaNonTaxableDevelopmentFee,
  etaNonTaxableOtherFee,
  etaPayableTotal,
  lineTaxableItems,
  lineTotalForEta,
} from '../../modules/electronic-invoices/utils/eta-tax-table';

describe('ETA withholding totals', () => {
  it('puts T4 on the line and subtracts it from the payable total', () => {
    const net = 3000;
    const vat = 420;
    const wht = 30;
    const taxes = lineTaxableItems({
      vatPercent: 14,
      vatAmount: vat,
      withholdingAmount: wht,
      netTotal: net,
      withholdingRate: 1,
    });
    const t4 = taxes.find((tax) => tax.taxType === 'T4');
    expect(taxes.filter((tax) => tax.taxType === 'T1')).toHaveLength(1);
    expect(t4).toMatchObject({ taxType: 'T4', amount: 30, rate: 1 });
    expect(lineTotalForEta(net, vat, wht)).toBe(3390);
    expect(etaPayableTotal(net, vat, wht)).toBe(3390);
    expect(etaPayableTotal(net, vat, 0)).toBe(3420);
  });

  it('maps a commercial discount into ETA discount, not itemsDiscount', () => {
    const salesTotal = 3000;
    const vat = 378;
    const wht = 81;
    const discount = etaCommercialDiscount(salesTotal, 300);
    expect(discount).toEqual({ amount: 300, rate: 10 });
    const netTotal = salesTotal - (discount?.amount ?? 0);
    const itemsDiscount = 0;
    expect(netTotal).toBe(2700);
    expect(lineTotalForEta(netTotal, vat, wht) - itemsDiscount).toBe(2997);
    expect(etaPayableTotal(netTotal, vat, wht, 0)).toBe(2997);
    expect(etaCommercialDiscount(salesTotal, 0)).toBeUndefined();
  });

  it('adds a post-tax addition as T20 and subtracts other discounts after the line total', () => {
    const net = 2700;
    const vat = 378;
    const wht = 81;
    const addition = etaNonTaxableOtherFee(50);
    expect(addition).toEqual({ taxType: 'T20', subType: 'OF04', rate: 0, amount: 50 });
    const lineTotal = lineTotalForEta(net, vat, wht, addition?.amount ?? 0);
    expect(lineTotal).toBe(3047);
    expect(lineTotal - 20).toBe(3027);
  });

  it('adds the development fee as non-taxable T16 without changing VAT', () => {
    const fee = etaNonTaxableDevelopmentFee(30);
    expect(fee).toEqual({ taxType: 'T16', subType: 'RD04', rate: 0, amount: 30 });
    expect(lineTotalForEta(2700, 378, 81, 30)).toBe(3027);
    expect(etaNonTaxableDevelopmentFee(0)).toBeUndefined();
  });

  it('allocates a header-only withholding so the line sum equals the header', () => {
    const shares = allocateHeaderWithholding([2000, 1000], 30);
    expect(shares).toEqual([20, 10]);
    const lineT4 = shares.reduce((sum, share, index) => {
      const net = index === 0 ? 2000 : 1000;
      const taxes = lineTaxableItems({
        vatPercent: 14,
        vatAmount: 0,
        withholdingAmount: share,
        netTotal: net,
      });
      return sum + (taxes.find((tax) => tax.taxType === 'T4')?.amount ?? 0);
    }, 0);
    expect(lineT4).toBe(30);
    expect(etaPayableTotal(3000, 420, lineT4)).toBe(3390);
  });
});
