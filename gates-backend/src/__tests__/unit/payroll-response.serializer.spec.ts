import {
  redactSensitiveDeep,
  serializeEmployeeRecord,
} from '../../modules/hr/services/payroll/payroll-response.serializer';

describe('payroll-response.serializer', () => {
  it('redacts nested compensation amounts', () => {
    const out = redactSensitiveDeep(
      {
        employees: [{ basicSalary: 5000, name: 'A' }],
        totals: { gross: 100 },
        contextSample: { comp_basic: 5000 },
      },
      false
    ) as Record<string, unknown>;
    const employees = out.employees as Array<Record<string, unknown>>;
    expect(employees[0].basicSalary).toBeNull();
    expect(out.contextSample).toBeNull();
    expect((out.totals as Record<string, unknown>).redacted).toBe(true);
  });

  it('serializeEmployeeRecord preserves when authorized', () => {
    const row = serializeEmployeeRecord({ basicSalary: 1, arabicName: 'x' }, true);
    expect(row.basicSalary).toBe(1);
    expect(row.amountsRedacted).toBe(false);
  });
});
