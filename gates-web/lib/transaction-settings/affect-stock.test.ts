import { describe, expect, it } from 'vitest';
import {
  purchaseInvoiceSourceTypes,
  salesInvoiceSourceTypes,
} from '@/lib/transaction-settings/affect-stock';

describe('salesInvoiceSourceTypes', () => {
  it('excludes delivery note when invoice affects stock', () => {
    const types = salesInvoiceSourceTypes(true);
    expect(types).not.toContain('DELIVERY_NOTE');
    expect(types).toContain('QUOTATION');
    expect(types).toContain('SALES_ORDER');
  });

  it('includes delivery note when invoice does not affect stock', () => {
    expect(salesInvoiceSourceTypes(false)).toContain('DELIVERY_NOTE');
  });
});

describe('purchaseInvoiceSourceTypes', () => {
  it('excludes goods receipt when invoice affects stock', () => {
    const types = purchaseInvoiceSourceTypes(true);
    expect(types).not.toContain('GOODS_RECEIPT');
    expect(types).toContain('PURCHASE_ORDER');
  });

  it('includes goods receipt when invoice does not affect stock', () => {
    expect(purchaseInvoiceSourceTypes(false)).toContain('GOODS_RECEIPT');
  });
});
