import {
  PAPER_JOURNAL_ENTRY_TYPE,
  buildEndorseLines,
  buildPaymentCollectLines,
  buildPaymentIssueLines,
  buildReceiptCollectLines,
  buildReceiptIssueLines,
  paperJournalLabel,
} from '../../modules/accounting/utils/commercial-paper-journals';

const base = {
  notesAccountId: 'notes',
  partyAccountId: 'party',
  bankAccountId: 'bank',
  supplierAccountId: 'supplier',
  amount: 1000,
};

describe('commercial paper journal builders', () => {
  it('builds a receipt issue (تحرير) as notes debit / party credit', () => {
    const lines = buildReceiptIssueLines(base);
    expect(lines).toEqual([
      expect.objectContaining({ accountId: 'notes', debit: 1000, credit: 0, lineOrder: 1 }),
      expect.objectContaining({ accountId: 'party', debit: 0, credit: 1000, lineOrder: 2 }),
    ]);
  });

  it('builds a payment issue (تحرير) as party debit / notes credit', () => {
    const lines = buildPaymentIssueLines(base);
    expect(lines[0]).toMatchObject({ accountId: 'party', debit: 1000 });
    expect(lines[1]).toMatchObject({ accountId: 'notes', credit: 1000 });
  });

  it('builds collect journals against the chosen bank account', () => {
    expect(buildReceiptCollectLines(base)[0]).toMatchObject({ accountId: 'bank', debit: 1000 });
    expect(buildPaymentCollectLines(base)[1]).toMatchObject({ accountId: 'bank', credit: 1000 });
  });

  it('builds endorse as supplier debit / notes credit', () => {
    const lines = buildEndorseLines(base);
    expect(lines[0]).toMatchObject({ accountId: 'supplier', debit: 1000 });
    expect(lines[1]).toMatchObject({ accountId: 'notes', credit: 1000 });
  });

  it('labels every lifecycle entry type in Arabic', () => {
    expect(paperJournalLabel(PAPER_JOURNAL_ENTRY_TYPE.ISSUE, 'CK-1')).toBe('قيد تحرير — CK-1');
    expect(paperJournalLabel(PAPER_JOURNAL_ENTRY_TYPE.COLLECT)).toBe('قيد تحصيل');
    expect(paperJournalLabel(PAPER_JOURNAL_ENTRY_TYPE.BOUNCE)).toBe('قيد ارتداد');
    expect(paperJournalLabel(PAPER_JOURNAL_ENTRY_TYPE.ENDORSE)).toBe('قيد تظهير');
    expect(paperJournalLabel(PAPER_JOURNAL_ENTRY_TYPE.MULTI)).toBe('قيد تحصيل متعدد');
  });
});
