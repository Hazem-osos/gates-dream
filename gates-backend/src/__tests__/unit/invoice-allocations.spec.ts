import { normalizeInvoiceAllocations } from '../../modules/accounting/utils/invoice-allocations';

describe('normalizeInvoiceAllocations', () => {
  it('keeps valid rows and drops junk', () => {
    expect(
      normalizeInvoiceAllocations([
        { invoiceId: 'inv-1', allocatedAmount: 10 },
        { invoiceId: '', allocatedAmount: 5 },
        { invoiceId: 'inv-2', allocatedAmount: 0 },
        { allocatedAmount: 3 },
      ])
    ).toEqual([{ invoiceId: 'inv-1', allocatedAmount: 10 }]);
  });

  it('returns empty for non-arrays', () => {
    expect(normalizeInvoiceAllocations(null)).toEqual([]);
    expect(normalizeInvoiceAllocations(undefined)).toEqual([]);
  });
});
