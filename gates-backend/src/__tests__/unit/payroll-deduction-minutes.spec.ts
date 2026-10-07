import {
  resolveBillableDeductionMinutes,
  validateDeductionMinuteInvariants,
} from '../../modules/hr/services/payroll/payroll-deduction-minutes.domain';

describe('payroll deduction minutes', () => {
  it('exposes non-overlapping billable buckets', () => {
    const b = resolveBillableDeductionMinutes({
      lateMinutes: 30,
      earlyLeaveMinutes: 120,
      absenceMinutes: 60,
      unpaidLeaveMinutes: 120,
    });
    expect(b.unpaidLeaveMinutes).toBe(120);
    expect(b.earlyLeaveBillableMinutes).toBe(0);
    expect(b.lateBillableMinutes).toBe(0);
    expect(b.absenceBillableMinutes).toBe(0);
    expect(validateDeductionMinuteInvariants({
      lateMinutes: 30,
      earlyLeaveMinutes: 120,
      absenceMinutes: 60,
      unpaidLeaveMinutes: 120,
    })).toEqual([]);
  });
});
