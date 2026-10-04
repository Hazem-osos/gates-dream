import { describe, expect, it } from 'vitest';
import {
  BUILTIN_SALES_INVOICE_PATTERN_ID,
  buildSalesInvoicePatternOptions,
} from './salesPatterns';

describe('sales invoice patterns for e-invoice settings', () => {
  it('always offers the default sales invoice when no SI01 screen exists', () => {
    expect(
      buildSalesInvoicePatternOptions({
        profiles: [{ id: 'profile-1', nameAr: 'مبيعات الجملة' }],
        modules: [],
      })
    ).toEqual([
      { id: BUILTIN_SALES_INVOICE_PATTERN_ID, label: 'فاتورة مبيعات' },
      { id: 'profile-1', label: 'مبيعات الجملة' },
    ]);
  });

  it('uses the SI01 screen instead of a second default row', () => {
    expect(
      buildSalesInvoicePatternOptions({
        profiles: [],
        modules: [{ id: 'mod-1', fullCode: 'SI01', menuNameAr: 'مبيعات نقدي', isActive: true }],
      })
    ).toEqual([{ id: 'mod-1', label: 'SI01 — مبيعات نقدي' }]);
  });
});