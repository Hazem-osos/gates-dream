import { AppError } from '../../shared/middleware/error-handler';
import {
  evaluatePayrollCondition,
  evaluatePayrollExpression,
} from '../../modules/hr/services/payroll/payroll-expression.evaluator';

describe('payroll-expression.evaluator', () => {
  const ctx = {
    comp_basic: 20000,
    period_days: 30,
    time_approved_overtime_minutes: 600,
    time_scheduled_minutes: 9600,
  };

  it('evaluates constant and arithmetic', () => {
    expect(evaluatePayrollExpression('20000 + 5000', ctx)).toBe(25000);
    expect(evaluatePayrollExpression('comp_basic / 2', ctx)).toBe(10000);
  });

  it('evaluates overtime proration style formula', () => {
    const expr =
      'comp_basic / time_scheduled_minutes * time_approved_overtime_minutes * 1.5';
    const v = evaluatePayrollExpression(expr, ctx);
    expect(v).toBeGreaterThan(0);
    expect(Number.isFinite(v)).toBe(true);
  });

  it('supports min/max/round', () => {
    expect(evaluatePayrollExpression('min(comp_basic, 1000)', ctx)).toBe(1000);
    expect(evaluatePayrollExpression('round(10.125, 2)', ctx)).toBe(10.13);
  });

  it('rejects unknown variables', () => {
    expect(() => evaluatePayrollExpression('secret_sauce', ctx)).toThrow(AppError);
  });

  it('rejects division by zero', () => {
    expect(() => evaluatePayrollExpression('comp_basic / 0', ctx)).toThrow(AppError);
  });

  it('evaluates conditions', () => {
    expect(evaluatePayrollCondition('comp_basic > 1000', ctx)).toBe(true);
    expect(evaluatePayrollCondition('comp_basic < 1000', ctx)).toBe(false);
    expect(evaluatePayrollCondition('comp_basic > 1000 && period_days == 30', ctx)).toBe(true);
  });

  it('is deterministic', () => {
    const a = evaluatePayrollExpression('comp_basic * 0.1 + 0.01', ctx);
    const b = evaluatePayrollExpression('comp_basic * 0.1 + 0.01', ctx);
    expect(a).toBe(b);
  });
});
