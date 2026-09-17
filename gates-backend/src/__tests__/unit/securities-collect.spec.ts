import { buildSecuritiesCollectJournalLines } from '../../modules/accounting/utils/securities-collect-lines';

describe('buildSecuritiesCollectJournalLines', () => {
  it('receipt: debit cash/bank, credit party', () => {
    const lines = buildSecuritiesCollectJournalLines({
      kind: 'receipt',
      amount: 1500,
      cashAccountId: 'cash-1',
      partyAccountId: 'cust-gl',
    });
    expect(lines).toEqual([
      { accountId: 'cash-1', debit: 1500, credit: 0, lineOrder: 1 },
      { accountId: 'cust-gl', debit: 0, credit: 1500, lineOrder: 2 },
    ]);
  });

  it('payment: debit party, credit cash/bank', () => {
    const lines = buildSecuritiesCollectJournalLines({
      kind: 'payment',
      amount: 800,
      cashAccountId: 'bank-1',
      partyAccountId: 'sup-gl',
    });
    expect(lines).toEqual([
      { accountId: 'sup-gl', debit: 800, credit: 0, lineOrder: 1 },
      { accountId: 'bank-1', debit: 0, credit: 800, lineOrder: 2 },
    ]);
  });
});
