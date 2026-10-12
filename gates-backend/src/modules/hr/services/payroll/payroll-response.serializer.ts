import {
  redactEmployeePayrollFields,
  redactPayrollComponents,
} from './payroll-field-redaction.util';

const SENSITIVE_EXACT_KEYS = new Set([
  'basicSalary',
  'fixedAllowances',
  'taxExemptionAmount',
  'bankAccountNumber',
  'iban',
  'grossSalary',
  'netSalary',
  'totalGross',
  'totalNet',
  'totalEmployeeInsurance',
  'totalTax',
  'totalAdvanceDeduction',
  'totalEmployerInsurance',
  'employeeInsurance',
  'tax',
  'advanceDeduction',
  'absenceDeduction',
  'otherDeductions',
  'amount',
  'quantity',
  'unitRate',
  'comp_basic',
  'comp_housing',
  'comp_transport',
  'nationalId',
  'socialInsuranceNumber',
]);

const SENSITIVE_KEY_FRAGMENTS = ['salary', 'iban', 'bankaccount', 'netpay', 'grosspay'];

function isSensitiveKey(key: string): boolean {
  if (SENSITIVE_EXACT_KEYS.has(key)) return true;
  const lower = key.toLowerCase();
  return SENSITIVE_KEY_FRAGMENTS.some((f) => lower.includes(f));
}

/** Deep redact sensitive payroll/compensation fields in API JSON trees. */
export function redactSensitiveDeep(value: unknown, includeSensitive: boolean): unknown {
  if (includeSensitive) return value;
  if (value === null || value === undefined) return value;
  if (Array.isArray(value)) {
    return value.map((v) => redactSensitiveDeep(v, false));
  }
  if (typeof value === 'object') {
    const src = value as Record<string, unknown>;
    const out: Record<string, unknown> = {};
    for (const [key, child] of Object.entries(src)) {
      if (isSensitiveKey(key)) {
        out[key] = null;
      } else if (key === 'totals' && child && typeof child === 'object') {
        out[key] = { redacted: true };
      } else if (key === 'vars' || key === 'contextSample') {
        out[key] = null;
      } else {
        out[key] = redactSensitiveDeep(child, false);
      }
    }
    if (!('amountsRedacted' in out)) out.amountsRedacted = true;
    return out;
  }
  return value;
}

export function serializePayrollRunRecord(run: Record<string, unknown>, includeAmounts: boolean) {
  if (includeAmounts) return { ...run, amountsRedacted: false };
  const copy = { ...run } as Record<string, unknown>;
  for (const key of [
    'totalGross',
    'totalNet',
    'totalEmployeeInsurance',
    'totalTax',
    'totalAdvanceDeduction',
    'totalEmployerInsurance',
  ]) {
    if (key in copy) copy[key] = null;
  }
  if (Array.isArray(copy.items)) {
    copy.items = (copy.items as Record<string, unknown>[]).map((item) => {
      const row = redactEmployeePayrollFields(item, false);
      if (Array.isArray(row.components)) {
        row.components = redactPayrollComponents(row.components as Record<string, unknown>[], false);
      }
      return row;
    });
  }
  copy.amountsRedacted = true;
  return copy;
}

export function serializeEmployeeRecord(employee: Record<string, unknown>, includeSensitive: boolean) {
  if (includeSensitive) return { ...employee, amountsRedacted: false };
  return { ...redactEmployeePayrollFields(employee, false), amountsRedacted: true };
}

/** Standard API payload wrapper for payroll monetary JSON. */
export function asPayrollApiData<T>(data: T, includeAmounts: boolean): T {
  if (includeAmounts) {
    return { ...(data as Record<string, unknown>), amountsRedacted: false } as T;
  }
  return redactSensitiveDeep(data, false) as T;
}
