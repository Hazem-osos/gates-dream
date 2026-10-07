import { AppError } from '../../shared/middleware/error-handler';
import { orderPayrollRules } from '../../modules/hr/services/payroll/payroll-rule-graph.domain';

describe('payroll-rule-graph', () => {
  it('orders by phase and detects missing dependency', () => {
    expect(() =>
      orderPayrollRules([
        {
          code: 'R2',
          componentCode: 'GROSS',
          phase: 2,
          priority: 1,
          dependsOn: ['R_MISSING'],
        },
      ])
    ).toThrow(AppError);
  });

  it('detects cycles', () => {
    expect(() =>
      orderPayrollRules([
        {
          code: 'R1',
          componentCode: 'A',
          phase: 1,
          priority: 1,
          dependsOn: ['R2'],
        },
        {
          code: 'R2',
          componentCode: 'B',
          phase: 1,
          priority: 2,
          dependsOn: ['R1'],
        },
      ])
    ).toThrow(/cycle/i);
  });

  it('orders phases ascending', () => {
    const ordered = orderPayrollRules([
      { code: 'R3', componentCode: 'NET', phase: 3, priority: 1, dependsOn: [] },
      { code: 'R1', componentCode: 'BASIC', phase: 1, priority: 1, dependsOn: [] },
      { code: 'R2', componentCode: 'GROSS', phase: 2, priority: 1, dependsOn: ['R1'] },
    ]);
    expect(ordered.map((n) => n.code)).toEqual(['R1', 'R2', 'R3']);
  });
});
