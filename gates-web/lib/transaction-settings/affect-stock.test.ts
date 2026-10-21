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

  it('includes stock and non-stock sources when invoice does not affect stock', () => {
    const types = salesInvoiceSourceTypes(false);
    expect(types).toContain('DELIVERY_NOTE');
    expect(types).toContain('QUOTATION');
    expect(types).toContain('SALES_ORDER');
  });
});

describe('purchaseInvoiceSourceTypes', () => {
  it('excludes goods receipt when invoice affects stock', () => {
    const types = purchaseInvoiceSourceTypes(true);
    expect(types).not.toContain('GOODS_RECEIPT');
    expect(types).toContain('PURCHASE_ORDER');
  });

  it('includes stock and non-stock sources when invoice does not affect stock', () => {
    const types = purchaseInvoiceSourceTypes(false);
    expect(types).toContain('GOODS_RECEIPT');
    expect(types).toContain('PURCHASE_ORDER');
    expect(types).toContain('QUOTATION');
  });
});
