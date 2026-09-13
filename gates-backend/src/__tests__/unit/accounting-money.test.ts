import { amountsEqualAt4 } from '../../shared/utils/decimal-round';
import {
  lineBaseAmount,
  sumBaseLines,
  toMoney4,
  validateJournalLineSides,
} from '../../shared/utils/money.util';

describe('accounting money utilities', () => {
  it('rounds to 4 decimal places', () => {
    expect(toMoney4(0.1 + 0.2)).toBe(0.3);
    expect(toMoney4(1.234567)).toBe(1.2346);
  });

  it('sums base lines with per-line FX round', () => {
    const { debitBase, creditBase } = sumBaseLines([
      { debit: 100, credit: 0, exchangeRate: 1.5 },
      { debit: 0, credit: 150, exchangeRate: 1 },
    ]);
    expect(debitBase).toBe(150);
    expect(creditBase).toBe(150);
    expect(amountsEqualAt4(debitBase, creditBase)).toBe(true);
  });

  it('lineBaseAmount matches product rounded', () => {
    expect(lineBaseAmount(10, 3.3333)).toBe(toMoney4(33.333));
  });

  it('validateJournalLineSides allows reversal signs', () => {
    expect(() =>
      validateJournalLineSides([
        { debit: -50, credit: 0 },
        { debit: 0, credit: -50 },
      ])
    ).not.toThrow();
  });

  it('rejects both sides non-zero', () => {
    expect(() =>
      validateJournalLineSides([{ debit: 1, credit: 1 }])
    ).toThrow(/both be non-zero/);
  });
});
