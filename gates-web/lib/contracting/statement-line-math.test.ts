import { describe, expect, it } from 'vitest';
import { remainingAfterCurrent, remainingStatementQty, statementLineAmounts } from './statement-line-math';

describe('statementLineAmounts', () => {
  it('matches handwritten current amount 0.15 × 13,500 = 2,025', () => {
    const row = statementLineAmounts({ previousQty: 22.35, currentQty: 0.15, unitPrice: 13500 });
    expect(row.currentAmount).toBe(2025);
    expect(row.cumulativeQty).toBeCloseTo(22.5);
    expect(row.cumulativeAmount).toBe(303750);
  });

  it('matches handwritten cumulative 22.5 × 13,500 = 303,750', () => {
    const row = statementLineAmounts({ previousQty: 0, currentQty: 22.5, unitPrice: 13500 });
    expect(row.currentAmount).toBe(303750);
    expect(row.cumulativeAmount).toBe(303750);
  });

  it('clamps remaining quantity at zero', () => {
    expect(remainingStatementQty(10, 12)).toBe(0);
    expect(remainingStatementQty(22.5, 22.35)).toBeCloseTo(0.15);
    expect(remainingAfterCurrent(22.5, 22.35, 0.15)).toBe(0);
    expect(remainingAfterCurrent(22.5, 10, 5)).toBe(7.5);
  });
});
