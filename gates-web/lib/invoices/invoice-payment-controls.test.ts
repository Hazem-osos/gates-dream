import { describe, expect, it } from 'vitest';
import { invoicePaymentButtonDisabled } from '@/lib/invoices/invoice-payment-controls';

describe('invoicePaymentButtonDisabled', () => {
  it('keeps sales invoice payment on posted view mode', () => {
    expect(
      invoicePaymentButtonDisabled('sales-invoice', {
        isPosted: true,
        isReadOnly: true,
      })
    ).toBe(false);
  });

  it('blocks purchase-style payment when posted', () => {
    expect(
      invoicePaymentButtonDisabled('other', {
        isPosted: true,
        isReadOnly: true,
      })
    ).toBe(true);
  });

  it('allows other surfaces only in edit mode', () => {
    expect(
      invoicePaymentButtonDisabled('other', {
        isPosted: false,
        isReadOnly: false,
      })
    ).toBe(false);
    expect(
      invoicePaymentButtonDisabled('other', {
        isPosted: false,
        isReadOnly: true,
      })
    ).toBe(true);
  });
});
