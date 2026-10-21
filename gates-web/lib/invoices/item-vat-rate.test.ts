import { describe, expect, it } from 'vitest';
import { DEFAULT_INVOICE_VAT_PERCENT, invoiceLineVatRate } from './item-vat-rate';

describe('invoiceLineVatRate', () => {
  it('is 0 when the VAT invoice flag is off', () => {
    expect(invoiceLineVatRate({ defaultTaxPercent: 14 }, false)).toBe(0);
    expect(invoiceLineVatRate({ isTaxExempt: true }, false)).toBe(0);
    expect(invoiceLineVatRate(undefined, false)).toBe(0);
  });

  it('uses the item card percent when VAT is on', () => {
    expect(invoiceLineVatRate({ defaultTaxPercent: 5 }, true)).toBe(5);
    expect(invoiceLineVatRate({ defaultTaxPercent: '10.00' }, true)).toBe(10);
  });

  it('is 0 for an exempt item even if a leftover percent exists', () => {
    expect(invoiceLineVatRate({ isTaxExempt: true, defaultTaxPercent: 14 }, true)).toBe(0);
    expect(invoiceLineVatRate({ isTaxExempt: true, defaultTaxPercent: 0 }, true)).toBe(0);
  });

  it('defaults to 14 when the item has no tax setting', () => {
    expect(invoiceLineVatRate(undefined, true)).toBe(DEFAULT_INVOICE_VAT_PERCENT);
    expect(invoiceLineVatRate({ defaultTaxPercent: null }, true)).toBe(DEFAULT_INVOICE_VAT_PERCENT);
    expect(invoiceLineVatRate({ defaultTaxPercent: '' }, true)).toBe(DEFAULT_INVOICE_VAT_PERCENT);
  });

  it('keeps an explicit 0 percent that is not marked exempt', () => {
    expect(invoiceLineVatRate({ defaultTaxPercent: 0 }, true)).toBe(0);
  });
});
