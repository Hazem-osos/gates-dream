import { billablePayrollTimeMinutes } from './payroll-billable-time.domain';

export type PayrollDeductionMinuteFacts = {
  lateMinutes: number;
  earlyLeaveMinutes: number;
  absenceMinutes: number;
  unpaidLeaveMinutes: number;
};

export type PayrollBillableDeductionMinutes = {
  unpaidLeaveMinutes: number;
  lateBillableMinutes: number;
  earlyLeaveBillableMinutes: number;
  absenceBillableMinutes: number;
};

/** Deterministic billable quantities for payroll deduction rules. */
export function resolveBillableDeductionMinutes(
  facts: PayrollDeductionMinuteFacts
): PayrollBillableDeductionMinutes {
  const billable = billablePayrollTimeMinutes(facts);
  return {
    unpaidLeaveMinutes: Math.max(0, facts.unpaidLeaveMinutes),
    lateBillableMinutes: billable.lateBillableMinutes,
    earlyLeaveBillableMinutes: billable.earlyLeaveBillableMinutes,
    absenceBillableMinutes: billable.absenceBillableMinutes,
  };
}

/**
 * Invariant: billable buckets must not exceed source minutes; total billed penalty
 * minutes must not exceed the union of source categories (no double charge).
 */
export function validateDeductionMinuteInvariants(
  facts: PayrollDeductionMinuteFacts
): string[] {
  const blockers: string[] = [];
  const b = resolveBillableDeductionMinutes(facts);

  if (b.lateBillableMinutes > facts.lateMinutes) {
    blockers.push('DEDUCTION_INVARIANT:LATE_BILLABLE_EXCEEDS_LATE');
  }
  if (b.earlyLeaveBillableMinutes > facts.earlyLeaveMinutes) {
    blockers.push('DEDUCTION_INVARIANT:EARLY_BILLABLE_EXCEEDS_EARLY');
  }
  if (b.absenceBillableMinutes > facts.absenceMinutes) {
    blockers.push('DEDUCTION_INVARIANT:ABSENCE_BILLABLE_EXCEEDS_ABSENCE');
  }

  const totalBilled =
    b.unpaidLeaveMinutes +
    b.lateBillableMinutes +
    b.earlyLeaveBillableMinutes +
    b.absenceBillableMinutes;
  const totalSource =
    facts.unpaidLeaveMinutes +
    facts.lateMinutes +
    facts.earlyLeaveMinutes +
    facts.absenceMinutes;
  if (totalBilled > totalSource + 1) {
    blockers.push('DEDUCTION_INVARIANT:DOUBLE_CHARGE_MINUTES');
  }

  return blockers;
}
