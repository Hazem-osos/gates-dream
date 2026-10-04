import { groupOpeningPapers } from '../../modules/accounting/utils/opening-paper-groups';

describe('opening paper groups', () => {
  it('sums cheques of the same account and keeps receipt and payment apart', () => {
    const { groups, missingAccount } = groupOpeningPapers(
      [
        { accountId: 'notes', direction: 'RECEIPT', amount: 100 },
        { accountId: 'notes', direction: 'RECEIPT', amount: 50.5 },
        { accountId: 'payable', direction: 'PAYMENT', amount: 40 },
        { accountId: 'notes', direction: 'PAYMENT', amount: 10 },
      ],
      { receiptAccountId: null, paymentAccountId: null }
    );

    expect(missingAccount).toBe(false);
    expect(groups).toEqual([
      { accountId: 'notes', direction: 'RECEIPT', amount: 150.5, count: 2 },
      { accountId: 'payable', direction: 'PAYMENT', amount: 40, count: 1 },
      { accountId: 'notes', direction: 'PAYMENT', amount: 10, count: 1 },
    ]);
  });

  it('uses the pattern fallback only when a saved cheque has no account', () => {
    const { groups, missingAccount } = groupOpeningPapers(
      [{ accountId: null, direction: 'RECEIPT', amount: 20 }],
      { receiptAccountId: 'fallback', paymentAccountId: null }
    );
    expect(missingAccount).toBe(false);
    expect(groups).toEqual([{ accountId: 'fallback', direction: 'RECEIPT', amount: 20, count: 1 }]);
  });

  it('reports a cheque that has no account and no fallback', () => {
    const { groups, missingAccount } = groupOpeningPapers(
      [{ accountId: null, direction: 'PAYMENT', amount: 5 }],
      { receiptAccountId: 'fallback', paymentAccountId: null }
    );
    expect(missingAccount).toBe(true);
    expect(groups).toEqual([]);
  });
});
