const SENSITIVE_EMPLOYEE_KEYS = [
  'basicSalary',
  'fixedAllowances',
  'taxExemptionAmount',
  'bankAccountNumber',
  'iban',
] as const;

export function redactEmployeePayrollFields<T extends Record<string, unknown>>(
  row: T,
  includeSensitive: boolean
): T {
  if (includeSensitive) return row;
  const copy = { ...row };
  for (const key of SENSITIVE_EMPLOYEE_KEYS) {
    if (key in copy) (copy as Record<string, unknown>)[key] = null;
  }
  return copy;
}

export function redactEmployeeList<T extends Record<string, unknown>>(
  rows: T[],
  includeSensitive: boolean
): T[] {
  return rows.map((r) => redactEmployeePayrollFields(r, includeSensitive));
}
