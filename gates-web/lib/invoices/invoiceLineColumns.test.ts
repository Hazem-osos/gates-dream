import { describe, expect, it } from 'vitest';
import {
  PURCHASE_INVOICE_STORAGE_DEFAULT,
  SALES_INVOICE_STORAGE_DEFAULT,
  customizableInvoiceColumns,
  stripSalesInvoiceHiddenColumns,
} from './invoiceLineColumns';

describe('invoice line columns', () => {
  it('keeps item stock on the default sales grid and hides landed cost on sales and purchase', () => {
    expect(SALES_INVOICE_STORAGE_DEFAULT).toContain('stockBalance');
    expect(SALES_INVOICE_STORAGE_DEFAULT).not.toContain('landedCost');
    expect(PURCHASE_INVOICE_STORAGE_DEFAULT).not.toContain('landedCost');
    expect(stripSalesInvoiceHiddenColumns(['unitPrice', 'landedCost', 'stockBalance'])).toEqual([
      'unitPrice',
      'stockBalance',
    ]);
    expect(customizableInvoiceColumns('gates:columns:sales-invoice').some((col) => col.id === 'landedCost')).toBe(
      false
    );
    expect(customizableInvoiceColumns('gates:columns:purchase-invoice').some((col) => col.id === 'landedCost')).toBe(
      false
    );
    expect(
      customizableInvoiceColumns('gates:columns:sales-invoice').find((col) => col.id === 'stockBalance')?.labelAr
    ).toBe('رصيد الصنف');
  });
});
