/** Documented payroll run transitions (existing status strings). */
export const PAYROLL_RUN_TRANSITIONS: Record<string, string[]> = {
  DRAFT: ['CALCULATED', 'CANCELLED'],
  CALCULATED: ['REVIEWED', 'APPROVED', 'DRAFT', 'CANCELLED'],
  REVIEWED: ['APPROVED', 'CALCULATED', 'CANCELLED'],
  APPROVED: ['POSTED', 'CALCULATED'],
  POSTED: ['PAID'],
  PAID: [],
  CANCELLED: [],
};

export function assertPayrollTransition(from: string, to: string): void {
  const allowed = PAYROLL_RUN_TRANSITIONS[from];
  if (!allowed?.includes(to)) {
    throw new Error(`Illegal payroll transition ${from} -> ${to}`);
  }
}
