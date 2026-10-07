/**
 * Payroll billable time minutes — avoid charging the same interval as unpaid leave and time penalty.
 */
export function billablePayrollTimeMinutes(facts: {
  lateMinutes: number;
  earlyLeaveMinutes: number;
  absenceMinutes: number;
  unpaidLeaveMinutes: number;
}): {
  lateBillableMinutes: number;
  earlyLeaveBillableMinutes: number;
  absenceBillableMinutes: number;
} {
  const unpaid = Math.max(0, facts.unpaidLeaveMinutes);
  return {
    lateBillableMinutes: Math.max(0, facts.lateMinutes - unpaid),
    earlyLeaveBillableMinutes: Math.max(0, facts.earlyLeaveMinutes - unpaid),
    absenceBillableMinutes: Math.max(0, facts.absenceMinutes - unpaid),
  };
}
