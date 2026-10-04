import { partyExtrasAsExtraDiscount } from '../../modules/invoices/services/invoice-adjustment.math';
import { etaPayableTotal } from '../../modules/electronic-invoices/utils/eta-tax-table';

describe('party extras as extra invoice discount', () => {
  it('sends deductions minus additions as the extra discount', () => {
    expect(partyExtrasAsExtraDiscount(20, 100)).toBe(80);
    expect(partyExtrasAsExtraDiscount(0, 100)).toBe(100);
    expect(partyExtrasAsExtraDiscount(20, 0)).toBe(-20);
  });

  it('reduces the payable total by that net, without an other-fee addition', () => {
    const net = 1000;
    const vat = 140;
    const extraDiscount = Math.max(0, partyExtrasAsExtraDiscount(20, 100));
    expect(extraDiscount).toBe(80);
    expect(etaPayableTotal(net, vat, 0, extraDiscount)).toBe(1060);
  });
});
