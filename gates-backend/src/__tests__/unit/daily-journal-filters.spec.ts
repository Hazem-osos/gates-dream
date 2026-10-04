import {
  amountMatches,
  collectSubtreeIds,
  parseDailyJournalAccountView,
  voucherNumberInRange,
} from '../../modules/accounting/utils/daily-journal-filters';

describe('daily journal filters', () => {
  it('matches amount operators', () => {
    expect(amountMatches(100, 'gt', 50)).toBe(true);
    expect(amountMatches(100, 'lt', 50)).toBe(false);
    expect(amountMatches(100, 'gte', 100)).toBe(true);
    expect(amountMatches(100, 'lte', 100)).toBe(true);
    expect(amountMatches(100, 'eq', 100)).toBe(true);
    expect(amountMatches(75, 'between', 50, 80)).toBe(true);
    expect(amountMatches(90, 'between', 80, 50)).toBe(false);
  });

  it('matches voucher numbers numerically', () => {
    expect(voucherNumberInRange('00000012', 10, 20)).toBe(true);
    expect(voucherNumberInRange('9', 10, 20)).toBe(false);
    expect(voucherNumberInRange('00000025', undefined, 20)).toBe(false);
    expect(voucherNumberInRange('', 1, 5)).toBe(false);
  });

  it('collects the account and every descendant', () => {
    const ids = collectSubtreeIds('main', [
      { id: 'main', parentId: null },
      { id: 'child', parentId: 'main' },
      { id: 'leaf', parentId: 'child' },
      { id: 'other', parentId: null },
    ]);
    expect(ids).toEqual(['main', 'child', 'leaf']);
  });

  it('defaults the account view to both', () => {
    expect(parseDailyJournalAccountView(undefined)).toBe('both');
    expect(parseDailyJournalAccountView('main')).toBe('main');
    expect(parseDailyJournalAccountView('ledger')).toBe('ledger');
  });
});
