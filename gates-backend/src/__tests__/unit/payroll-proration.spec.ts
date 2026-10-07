import {
  buildCompensationSegments,
  sumSegmentsByCode,
} from '../../modules/hr/services/payroll/payroll-proration.domain';

describe('payroll-proration', () => {
  it('splits mid-period basic change', () => {
    const segments = buildCompensationSegments({
      periodStart: '2026-01-01',
      periodEnd: '2026-01-31',
      method: 'CALENDAR_DAYS',
      components: [
        { code: 'BASIC', amount: 20000, effectiveFrom: '2026-01-01', effectiveTo: '2026-01-15' },
        { code: 'BASIC', amount: 25000, effectiveFrom: '2026-01-16', effectiveTo: null },
      ],
    });
    const totals = sumSegmentsByCode(segments);
    expect(segments.length).toBe(2);
    expect(totals.BASIC).toBeGreaterThan(20000);
    expect(totals.BASIC).toBeLessThan(25000);
  });

  it('handles joiner mid-month', () => {
    const segments = buildCompensationSegments({
      periodStart: '2026-02-01',
      periodEnd: '2026-02-28',
      method: 'CALENDAR_DAYS',
      employmentStart: '2026-02-15',
      components: [{ code: 'BASIC', amount: 30000, effectiveFrom: '2026-01-01', effectiveTo: null }],
    });
    const totals = sumSegmentsByCode(segments);
    expect(totals.BASIC).toBeLessThan(30000);
  });

  it('handles leap February', () => {
    const segments = buildCompensationSegments({
      periodStart: '2024-02-01',
      periodEnd: '2024-02-29',
      method: 'CALENDAR_DAYS',
      components: [{ code: 'BASIC', amount: 29000, effectiveFrom: '2024-01-01', effectiveTo: null }],
    });
    expect(segments[0].segmentDays).toBe(29);
    expect(sumSegmentsByCode(segments).BASIC).toBe(29000);
  });
});
