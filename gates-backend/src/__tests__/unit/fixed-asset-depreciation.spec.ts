import {
  depreciateMonths,
  disposalGainLoss,
  firstDepreciationMonth,
  isFullyDepreciated,
  lastDepreciationMonthOnDisposal,
  monthEndDate,
  monthKey,
  projectSchedule,
  type DepreciableAsset,
} from '../../modules/fixed-assets/domain/depreciation';

const d = (iso: string) => new Date(`${iso}T00:00:00.000Z`);
const m = (iso: string) => monthKey(d(`${iso}-01`));
const sum = (values: number[]) => Math.round(values.reduce((a, b) => a + b, 0) * 10000) / 10000;

function asset(over: Partial<DepreciableAsset> = {}): DepreciableAsset {
  return {
    method: 'STRAIGHT_LINE',
    cost: 12000,
    salvageValue: 0,
    usefulLifeMonths: 12,
    decliningRate: null,
    inServiceDate: d('2026-01-01'),
    ...over,
  };
}

const fresh = { accumulated: 0, accumulatedAtYearStart: 0 };

describe('fixed asset depreciation — 15th-of-month rule', () => {
  it('starts in the same month when in service on or before the 15th', () => {
    expect(firstDepreciationMonth(d('2026-03-15'))).toBe(m('2026-03'));
    expect(firstDepreciationMonth(d('2026-03-01'))).toBe(m('2026-03'));
  });

  it('starts next month when in service after the 15th', () => {
    expect(firstDepreciationMonth(d('2026-03-16'))).toBe(m('2026-04'));
    expect(firstDepreciationMonth(d('2026-12-31'))).toBe(m('2027-01'));
  });

  it('ends with the previous month when disposed on or before the 15th', () => {
    expect(lastDepreciationMonthOnDisposal(d('2026-05-10'))).toBe(m('2026-04'));
    expect(lastDepreciationMonthOnDisposal(d('2026-05-20'))).toBe(m('2026-05'));
  });

  it('month end dates are the last calendar day', () => {
    expect(monthEndDate(m('2026-02')).toISOString().slice(0, 10)).toBe('2026-02-28');
    expect(monthEndDate(m('2028-02')).toISOString().slice(0, 10)).toBe('2028-02-29');
    expect(monthEndDate(m('2026-12')).toISOString().slice(0, 10)).toBe('2026-12-31');
  });
});

describe('straight line', () => {
  it('books equal monthly amounts and stops at the end of life', () => {
    const { lines } = depreciateMonths(asset(), m('2026-01'), m('2027-03'), fresh);
    expect(lines).toHaveLength(12);
    expect(lines.every((l) => l.amount === 1000)).toBe(true);
    expect(lines[11].accumulatedAfter).toBe(12000);
    expect(lines[11].bookValueAfter).toBe(0);
  });

  it('rounds to 4 decimals and still totals the base exactly', () => {
    const { lines } = depreciateMonths(asset({ cost: 1000, usefulLifeMonths: 3 }), m('2026-01'), m('2026-06'), fresh);
    expect(lines).toHaveLength(3);
    for (const line of lines) expect(Math.abs(line.amount - 333.3333)).toBeLessThanOrEqual(0.0001);
    expect(sum(lines.map((l) => l.amount))).toBe(1000);
    expect(lines[2].bookValueAfter).toBe(0);
  });

  it('never depreciates below the salvage value', () => {
    const a = asset({ cost: 10000, salvageValue: 1000, usefulLifeMonths: 36 });
    const { lines } = depreciateMonths(a, m('2026-01'), m('2030-12'), fresh);
    expect(lines).toHaveLength(36);
    expect(lines[0].amount).toBe(250);
    expect(lines[35].accumulatedAfter).toBe(9000);
    expect(lines[35].bookValueAfter).toBe(1000);
    expect(isFullyDepreciated(a, 9000)).toBe(true);
  });

  it('respects the start month for an asset in service after the 15th', () => {
    const { lines } = depreciateMonths(asset({ inServiceDate: d('2026-01-20') }), m('2026-01'), m('2026-03'), fresh);
    expect(lines.map((l) => l.month)).toEqual([m('2026-02'), m('2026-03')]);
  });

  it('continues an opening asset from its opening accumulated depreciation', () => {
    const { lines } = depreciateMonths(asset(), m('2026-07'), m('2026-12'), {
      accumulated: 6000,
      accumulatedAtYearStart: 0,
    });
    expect(lines).toHaveLength(6);
    expect(lines.every((l) => l.amount === 1000)).toBe(true);
    expect(lines[5].accumulatedAfter).toBe(12000);
  });

  it('applies a useful-life revision prospectively', () => {
    // 6 months booked on a 12-month life, then the life is extended to 18 months.
    const { lines } = depreciateMonths(asset({ usefulLifeMonths: 18 }), m('2026-07'), m('2027-12'), {
      accumulated: 6000,
      accumulatedAtYearStart: 0,
    });
    expect(lines[0].amount).toBe(500);
    expect(lines).toHaveLength(12);
    expect(sum(lines.map((l) => l.amount))).toBe(6000);
  });

  it('books the whole remainder at once when the life is already over', () => {
    const a = asset({ inServiceDate: d('2020-01-01'), usefulLifeMonths: 12 });
    const { lines } = depreciateMonths(a, m('2026-01'), m('2026-03'), {
      accumulated: 9000,
      accumulatedAtYearStart: 9000,
    });
    expect(lines).toHaveLength(1);
    expect(lines[0].amount).toBe(3000);
  });
});

describe('declining balance', () => {
  const db = asset({ method: 'DECLINING_BALANCE', cost: 10000, usefulLifeMonths: 120, decliningRate: 25 });

  it('uses the book value at the start of each year', () => {
    const { lines } = depreciateMonths(db, m('2026-01'), m('2027-01'), fresh);
    expect(lines[0].amount).toBe(208.3333);
    const year2026 = sum(lines.slice(0, 12).map((l) => l.amount));
    expect(year2026).toBe(2499.9996);
    // 2027 base = 10000 − 2499.9996 = 7500.0004 → × 25% / 12
    expect(lines[12].amount).toBe(156.25);
  });

  it('carries the year-start balance correctly when a run starts mid-year', () => {
    const { lines } = depreciateMonths(db, m('2026-11'), m('2027-01'), {
      accumulated: 2083.333,
      accumulatedAtYearStart: 0,
    });
    expect(lines[0].amount).toBe(208.3333);
    expect(lines[1].amount).toBe(208.3333);
    const yearStart2027 = 2083.333 + 208.3333 * 2;
    expect(lines[2].amount).toBe(Math.round(((10000 - yearStart2027) * 0.25 * 10000) / 12) / 10000);
  });

  it('takes the remainder to salvage in the last month of life', () => {
    const short = { ...db, usefulLifeMonths: 2 };
    const { lines } = depreciateMonths(short, m('2026-01'), m('2026-05'), fresh);
    expect(lines).toHaveLength(2);
    expect(sum(lines.map((l) => l.amount))).toBe(10000);
  });
});

describe('no depreciation (land)', () => {
  it('never books anything', () => {
    const land = asset({ method: 'NONE' });
    expect(depreciateMonths(land, m('2026-01'), m('2030-01'), fresh).lines).toHaveLength(0);
    expect(projectSchedule(land, m('2026-01'), fresh)).toHaveLength(0);
  });
});

describe('schedule projection', () => {
  it('projects exactly the depreciable base', () => {
    const a = asset({ cost: 7777.77, salvageValue: 77.7, usefulLifeMonths: 37 });
    const lines = projectSchedule(a, m('2026-01'), fresh);
    expect(lines).toHaveLength(37);
    expect(sum(lines.map((l) => l.amount))).toBe(7700.07);
  });
});

describe('disposal gain / loss', () => {
  it('is proceeds minus book value', () => {
    expect(disposalGainLoss(10000, 7000, 4000)).toEqual({ bookValue: 3000, gainLoss: 1000 });
    expect(disposalGainLoss(10000, 7000, 0)).toEqual({ bookValue: 3000, gainLoss: -3000 });
    expect(disposalGainLoss(10000, 10000, 0)).toEqual({ bookValue: 0, gainLoss: 0 });
  });
});
