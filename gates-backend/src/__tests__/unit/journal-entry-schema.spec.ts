import { createJournalEntrySchema } from '../../modules/accounting/schemas/journal-entry.schema';

const accountA = '11111111-1111-4111-8111-111111111111';
const accountB = '22222222-2222-4222-8222-222222222222';

describe('createJournalEntrySchema', () => {
  it('drops leftover blank grid lines and accepts a date-only header', () => {
    const parsed = createJournalEntrySchema.parse({
      date: '2026-10-04',
      currencyCode: 'EGP',
      lines: [
        { accountId: accountA, debit: '100', credit: '0', lineOrder: '1' },
        { accountId: accountB, debit: 0, credit: 100, lineOrder: 2 },
        { accountId: '', debit: 0, credit: 0, lineOrder: 3 },
      ],
    });
    expect(parsed.lines).toHaveLength(2);
    expect(parsed.lines[0]?.debit).toBe(100);
    expect(parsed.date).toBe('2026-10-04');
  });

  it('rejects a single meaningful line', () => {
    const result = createJournalEntrySchema.safeParse({
      date: '2026-10-04T00:00:00.000Z',
      currencyCode: 'EGP',
      lines: [{ accountId: accountA, debit: 50, credit: 0, lineOrder: 1 }],
    });
    expect(result.success).toBe(false);
  });
});
