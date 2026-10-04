import { invoiceNumberRange } from '../../modules/inventory/services/invoice-number-range';

describe('invoice number range', () => {
  it('treats a single invoice number as that number', () => {
    expect(invoiceNumberRange('15', '15')).toEqual({ start: 15, end: 15 });
  });

  it('opens the end when only the from number is set', () => {
    expect(invoiceNumberRange('15', '')).toEqual({ start: 15, end: 999_999_999 });
  });

  it('orders an inverted range', () => {
    expect(invoiceNumberRange('20', '10')).toEqual({ start: 10, end: 20 });
  });

  it('ignores a blank range', () => {
    expect(invoiceNumberRange('', undefined)).toBeNull();
  });
});
