import {
  isDateInEffectiveRange,
  rangesOverlap,
  previousDateOnly,
  toDateOnly,
} from '../../modules/hr/utils/hr-effective-date.util';

describe('hr-effective-date.util', () => {
  it('detects inclusive range membership', () => {
    const from = toDateOnly('2026-01-01');
    const to = toDateOnly('2026-06-30');
    expect(isDateInEffectiveRange(toDateOnly('2026-03-01'), from, to)).toBe(true);
    expect(isDateInEffectiveRange(toDateOnly('2026-07-01'), from, to)).toBe(false);
    expect(isDateInEffectiveRange(toDateOnly('2026-12-01'), from, null)).toBe(true);
  });

  it('detects overlapping ranges', () => {
    const aFrom = toDateOnly('2026-01-01');
    const aTo = toDateOnly('2026-06-30');
    const bFrom = toDateOnly('2026-06-01');
    const bTo = toDateOnly('2026-12-31');
    expect(rangesOverlap(aFrom, aTo, bFrom, bTo)).toBe(true);
    expect(rangesOverlap(aFrom, aTo, toDateOnly('2026-07-01'), bTo)).toBe(false);
  });

  it('previousDateOnly steps back one UTC day', () => {
    const d = previousDateOnly(toDateOnly('2026-07-01'));
    expect(d.toISOString().slice(0, 10)).toBe('2026-06-30');
  });
});
