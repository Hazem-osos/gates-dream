import { billablePayrollTimeMinutes } from '../../modules/hr/services/payroll/payroll-billable-time.domain';

describe('payroll billable time', () => {
  it('does not bill early leave when covered by unpaid leave minutes', () => {
    const r = billablePayrollTimeMinutes({
      lateMinutes: 0,
      earlyLeaveMinutes: 120,
      absenceMinutes: 0,
      unpaidLeaveMinutes: 120,
    });
    expect(r.earlyLeaveBillableMinutes).toBe(0);
    expect(r.lateBillableMinutes).toBe(0);
  });

  it('bills only the excess early leave beyond unpaid leave', () => {
    const r = billablePayrollTimeMinutes({
      lateMinutes: 30,
      earlyLeaveMinutes: 150,
      absenceMinutes: 60,
      unpaidLeaveMinutes: 120,
    });
    expect(r.earlyLeaveBillableMinutes).toBe(30);
    expect(r.lateBillableMinutes).toBe(0);
    expect(r.absenceBillableMinutes).toBe(0);
  });
});
