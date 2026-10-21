import { buildInvoiceJournalPreviewOptions } from '@/lib/invoices/invoice-journal-preview';

describe('buildInvoiceJournalPreviewOptions', () => {
  it('returns revenue and COGS options for posted sales invoices', () => {
    const opts = buildInvoiceJournalPreviewOptions(
      {
        journalEntryId: 'rev-1',
        costJournalEntryId: 'cogs-1',
        journalEntry: { voucherNumber: '00000010' },
        costJournalEntry: { voucherNumber: '00000011' },
      },
      'sales'
    );
    expect(opts).toHaveLength(2);
    expect(opts[0]).toEqual({
      id: 'rev-1',
      label: 'فاتورة مبيعات وعميل — 00000010',
    });
    expect(opts[1]).toEqual({
      id: 'cogs-1',
      label: 'تكلفة ومخزون — 00000011',
    });
  });

  it('returns only main entry when COGS journal is absent', () => {
    const opts = buildInvoiceJournalPreviewOptions({ journalEntryId: 'rev-1' }, 'sales');
    expect(opts).toHaveLength(1);
    expect(opts[0].id).toBe('rev-1');
  });
});
