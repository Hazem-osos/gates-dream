import { describe, expect, it } from 'vitest';
import {
  complementarySourceTypes,
  sourceTypeAffectsStock,
  sourceTypesForLoadBar,
} from './sourceDocument';

const bothInvoicesAffectStock = {
  salesInvoiceAffectsStock: true,
  purchaseInvoiceAffectsStock: true,
};

const invoicesDoNotAffectStock = {
  salesInvoiceAffectsStock: false,
  purchaseInvoiceAffectsStock: false,
};

describe('sourceTypeAffectsStock', () => {
  it('treats quotes and orders as non-stock', () => {
    expect(sourceTypeAffectsStock('QUOTATION', bothInvoicesAffectStock)).toBe(false);
    expect(sourceTypeAffectsStock('SALES_ORDER', bothInvoicesAffectStock)).toBe(false);
    expect(sourceTypeAffectsStock('PURCHASE_ORDER', bothInvoicesAffectStock)).toBe(false);
  });

  it('treats warehouse permits as stock', () => {
    expect(sourceTypeAffectsStock('DELIVERY_NOTE', bothInvoicesAffectStock)).toBe(true);
    expect(sourceTypeAffectsStock('GOODS_RECEIPT', bothInvoicesAffectStock)).toBe(true);
  });

  it('follows the invoice stock setting', () => {
    expect(sourceTypeAffectsStock('SALES_INVOICE', bothInvoicesAffectStock)).toBe(true);
    expect(sourceTypeAffectsStock('SALES_INVOICE', invoicesDoNotAffectStock)).toBe(false);
  });
});

describe('complementarySourceTypes', () => {
  it('hides stock sources when the open document affects stock', () => {
    const types = complementarySourceTypes(true, bothInvoicesAffectStock);
    expect(types).toEqual(['QUOTATION', 'SALES_ORDER', 'PURCHASE_ORDER']);
  });

  it('shows stock and non-stock sources when the open document does not affect stock', () => {
    const types = complementarySourceTypes(false, bothInvoicesAffectStock);
    expect(types).toEqual([
      'QUOTATION',
      'SALES_ORDER',
      'PURCHASE_ORDER',
      'PURCHASE_INVOICE',
      'DELIVERY_NOTE',
      'GOODS_RECEIPT',
      'SALES_INVOICE',
    ]);
  });
});

describe('sourceTypesForLoadBar', () => {
  it('keeps sales returns on the original sales invoice only', () => {
    expect(
      sourceTypesForLoadBar({
        role: 'sales-return',
        currentAffectsStock: true,
        policies: bothInvoicesAffectStock,
      })
    ).toEqual(['SALES_INVOICE']);
  });

  it('keeps purchase returns on the original purchase invoice only', () => {
    expect(
      sourceTypesForLoadBar({
        role: 'purchase-return',
        currentAffectsStock: true,
        policies: bothInvoicesAffectStock,
      })
    ).toEqual(['PURCHASE_INVOICE']);
  });
});
