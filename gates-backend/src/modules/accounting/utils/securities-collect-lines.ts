export type SecuritiesCollectKind = 'receipt' | 'payment';

export function buildSecuritiesCollectJournalLines(params: {
  kind: SecuritiesCollectKind;
  amount: number;
  cashAccountId: string;
  partyAccountId: string;
}): Array<{ accountId: string; debit: number; credit: number; lineOrder: number }> {
  const amount = Number(params.amount);
  if (params.kind === 'receipt') {
    return [
      { accountId: params.cashAccountId, debit: amount, credit: 0, lineOrder: 1 },
      { accountId: params.partyAccountId, debit: 0, credit: amount, lineOrder: 2 },
    ];
  }
  return [
    { accountId: params.partyAccountId, debit: amount, credit: 0, lineOrder: 1 },
    { accountId: params.cashAccountId, debit: 0, credit: amount, lineOrder: 2 },
  ];
}
