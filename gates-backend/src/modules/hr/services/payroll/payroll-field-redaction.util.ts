const SENSITIVE_EMPLOYEE_KEYS = [
  'basicSalary',
  'fixedAllowances',
  'taxExemptionAmount',
  'bankAccountNumber',
  'iban',
  'grossSalary',
  'netSalary',
  'totalGross',
  'totalNet',
] as const;

const SENSITIVE_PAYROLL_COMPONENT_KEYS = ['amount', 'quantity', 'unitRate'] as const;

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

export function redactPayrollComponents<T extends Record<string, unknown>>(
  rows: T[],
  includeSensitive: boolean
): T[] {
  if (includeSensitive) return rows;
  return rows.map((row) => {
    const copy = { ...row };
    for (const key of SENSITIVE_PAYROLL_COMPONENT_KEYS) {
      if (key in copy) (copy as Record<string, unknown>)[key] = null;
    }
    return copy;
  });
}

/** Redact monetary fields on payroll run / report payloads. */
export function redactPayrollMoneyPayload<T extends Record<string, unknown>>(
  payload: T,
  includeSensitive: boolean
): T {
  if (includeSensitive) return payload;
  const copy = { ...payload } as Record<string, unknown>;
  for (const key of SENSITIVE_EMPLOYEE_KEYS) {
    if (key in copy) copy[key] = null;
  }
  if (copy.totals && typeof copy.totals === 'object') {
    copy.totals = { redacted: true };
  }
  if (Array.isArray(copy.rows)) {
    copy.rows = (copy.rows as Record<string, unknown>[]).map((r) =>
      redactEmployeePayrollFields(r, false)
    );
  }
  if (Array.isArray(copy.components)) {
    copy.components = redactPayrollComponents(copy.components as Record<string, unknown>[], false);
  }
  copy.amountsRedacted = true;
  return copy as T;
}
