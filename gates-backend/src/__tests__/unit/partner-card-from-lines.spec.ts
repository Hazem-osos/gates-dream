import { linkedCardColumnDelta } from '../../modules/accounting/services/ledger-balance.service';

describe('partner card delta from journal line', () => {
  it('increases customer cache on AR debit (credit sale)', () => {
    const delta = linkedCardColumnDelta('CUSTOMER', 100, 0);
    expect(Number(delta)).toBe(100);
  });

  it('decreases customer cache on AR credit (collection)', () => {
    const delta = linkedCardColumnDelta('CUSTOMER', 0, 50);
    expect(Number(delta)).toBe(-50);
  });
});
