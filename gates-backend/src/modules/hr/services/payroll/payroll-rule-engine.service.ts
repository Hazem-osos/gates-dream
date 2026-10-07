import { createHash } from 'crypto';
import prisma from '../../../../shared/database/prisma';
import { AppError } from '../../../../shared/middleware/error-handler';
import { roundTo4 } from '../../../../shared/utils/decimal-round';
import {
  evaluatePayrollCondition,
  evaluatePayrollExpression,
} from './payroll-expression.evaluator';
import { orderPayrollRules } from './payroll-rule-graph.domain';
import type {
  CalculatedComponentLine,
  EmployeePayrollCalculationResult,
  PayrollCalculationContext,
} from './payroll-calculation.types';
import { payrollEngineService } from '../payroll-engine.service';

type LoadedRule = {
  id: string;
  code: string;
  componentCode: string;
  componentType: string;
  payComponentId: string;
  phase: number;
  priority: number;
  conditionExpr: string | null;
  formulaExpr: string;
  roundingMode: string;
  minAmount: number | null;
  maxAmount: number | null;
  dependsOn: string[];
};

export class PayrollRuleEngineService {
  async fingerprintRules(companyId: string, asOf: Date): Promise<string> {
    const rules = await prisma.hcmPayrollRule.findMany({
      where: {
        companyId,
        isActive: true,
        effectiveFrom: { lte: asOf },
        OR: [{ effectiveTo: null }, { effectiveTo: { gte: asOf } }],
      },
      select: { id: true, code: true, formulaExpr: true, updatedAt: true },
      orderBy: { code: 'asc' },
    });
    const payload = JSON.stringify(rules);
    return createHash('sha256').update(payload).digest('hex').slice(0, 32);
  }

  async companyUsesRuleEngine(companyId: string, asOf: Date): Promise<boolean> {
    const count = await prisma.hcmPayrollRule.count({
      where: {
        companyId,
        isActive: true,
        effectiveFrom: { lte: asOf },
        OR: [{ effectiveTo: null }, { effectiveTo: { gte: asOf } }],
      },
    });
    return count > 0;
  }

  async loadRules(companyId: string, asOf: Date): Promise<LoadedRule[]> {
    const rows = await prisma.hcmPayrollRule.findMany({
      where: {
        companyId,
        isActive: true,
        effectiveFrom: { lte: asOf },
        OR: [{ effectiveTo: null }, { effectiveTo: { gte: asOf } }],
      },
      include: { payComponent: { select: { code: true, componentType: true } } },
    });
    return rows.map((r) => ({
      id: r.id,
      code: r.code,
      componentCode: r.payComponent.code,
      componentType: r.payComponent.componentType,
      payComponentId: r.payComponentId,
      phase: r.phase,
      priority: r.priority,
      conditionExpr: r.conditionExpr,
      formulaExpr: r.formulaExpr,
      roundingMode: r.roundingMode,
      minAmount: r.minAmount != null ? Number(r.minAmount) : null,
      maxAmount: r.maxAmount != null ? Number(r.maxAmount) : null,
      dependsOn: r.dependsOnCodes ? (JSON.parse(r.dependsOnCodes) as string[]) : [],
    }));
  }

  calculateWithRules(
    ctx: PayrollCalculationContext,
    rules: LoadedRule[]
  ): EmployeePayrollCalculationResult {
    const ordered = orderPayrollRules(
      rules.map((r) => ({
        code: r.code,
        componentCode: r.componentCode,
        phase: r.phase,
        priority: r.priority,
        dependsOn: r.dependsOn,
      }))
    );
    const ruleByCode = new Map(rules.map((r) => [r.code, r]));
    const orderedRules = ordered.map((n) => ruleByCode.get(n.code)!);

    const components: CalculatedComponentLine[] = [];
    const vars = { ...ctx.vars };
    for (const rule of orderedRules) {
      const key = `comp_${rule.componentCode.toLowerCase()}`;
      if (vars[key] == null) vars[key] = 0;
    }

    for (const rule of orderedRules) {
      if (rule.conditionExpr && !evaluatePayrollCondition(rule.conditionExpr, vars)) {
        continue;
      }
      let amount = evaluatePayrollExpression(rule.formulaExpr, vars);
      if (rule.minAmount != null) amount = Math.max(amount, rule.minAmount);
      if (rule.maxAmount != null) amount = Math.min(amount, rule.maxAmount);
      amount = this.applyRounding(amount, rule.roundingMode);

      vars[`comp_${rule.componentCode.toLowerCase()}`] = amount;
      vars[rule.componentCode.toLowerCase()] = amount;

      const formulaFp = createHash('sha256')
        .update(`${rule.formulaExpr}|${rule.conditionExpr ?? ''}|${rule.roundingMode}`)
        .digest('hex')
        .slice(0, 16);
      components.push({
        componentCode: rule.componentCode,
        componentType: rule.componentType,
        payComponentId: rule.payComponentId,
        phase: rule.phase,
        amount,
        ruleCode: rule.code,
        ruleId: rule.id,
        ruleFingerprint: formulaFp,
        ruleFormulaFingerprint: formulaFp,
        roundingMode: rule.roundingMode,
        branchIdSnapshot: ctx.employee.branchId,
        departmentIdSnapshot: ctx.employee.departmentId,
        costCenterIdSnapshot: ctx.employee.costCenterId,
        explanation: {
          formula: rule.formulaExpr,
          condition: rule.conditionExpr ?? null,
          friendly: this.friendlyExplanation(rule.componentCode, amount, ctx, rule),
        },
      });
    }

    this.expandAdvanceRecoveryLines(components, ctx);
    return this.aggregateToPayrollRunItem(ctx.employee.employeeId, components, vars, []);
  }

  private expandAdvanceRecoveryLines(
    components: CalculatedComponentLine[],
    ctx: PayrollCalculationContext
  ) {
    const idx = components.findIndex((c) => c.componentCode === 'ADVANCE_RECOVERY');
    if (idx < 0) return;
    const template = components[idx];
    const target = roundTo4(template.amount);
    components.splice(idx, 1);
    if (target <= 0) return;

    let remaining = target;
    let fifo = 0;
    for (const line of ctx.advances.lines) {
      if (remaining <= 0) break;
      const take = roundTo4(Math.min(remaining, line.amount));
      if (take <= 0) continue;
      fifo += 1;
      components.push({
        ...template,
        amount: take,
        sourceType: 'EMPLOYEE_ADVANCE',
        sourceRef: line.advanceId,
        explanation: {
          ...(typeof template.explanation === 'object' && template.explanation
            ? (template.explanation as Record<string, unknown>)
            : {}),
          friendly: `Advance recovery FIFO #${fifo} from advance ${line.advanceId} = ${take}`,
          advanceId: line.advanceId,
          fifoOrder: fifo,
          recoveryAmount: take,
        },
      });
      remaining = roundTo4(remaining - take);
    }
    if (remaining > 0) {
      components.push({
        ...template,
        amount: remaining,
        explanation: {
          friendly: `Advance recovery remainder = ${remaining}`,
          recoveryAmount: remaining,
        },
      });
    }
  }

  /** Legacy path + synthetic component lines for explainability. */
  async calculateLegacy(
    companyId: string,
    ctx: PayrollCalculationContext,
    manualInput?: { overtime?: number; absenceDeduction?: number; otherDeductions?: number }
  ): Promise<EmployeePayrollCalculationResult> {
    const line = await payrollEngineService.calculateEmployeePayroll(companyId, ctx.employee.employeeId, {
      overtime: manualInput?.overtime,
      absenceDeduction: manualInput?.absenceDeduction,
      otherDeductions: manualInput?.otherDeductions,
    });

    const components: CalculatedComponentLine[] = [
      { componentCode: 'BASIC', componentType: 'EARNING', phase: 1, amount: line.basicSalary },
      { componentCode: 'ALLOWANCES', componentType: 'EARNING', phase: 1, amount: line.allowances },
      { componentCode: 'OVERTIME', componentType: 'EARNING', phase: 2, amount: line.overtime },
      { componentCode: 'ABSENCE', componentType: 'DEDUCTION', phase: 2, amount: line.absenceDeduction },
      { componentCode: 'OTHER_DEDUCTION', componentType: 'DEDUCTION', phase: 7, amount: line.otherDeductions },
      { componentCode: 'SOCIAL_INSURANCE_EE', componentType: 'DEDUCTION', phase: 6, amount: line.employeeInsurance },
      { componentCode: 'TAX', componentType: 'DEDUCTION', phase: 6, amount: line.tax },
      { componentCode: 'ADVANCE_RECOVERY', componentType: 'DEDUCTION', phase: 8, amount: line.advanceDeduction },
      { componentCode: 'SOCIAL_INSURANCE_ER', componentType: 'EMPLOYER_CONTRIBUTION', phase: 9, amount: line.employerInsurance },
    ];

    return {
      employeeId: line.employeeId,
      components,
      basicSalary: line.basicSalary,
      allowances: line.allowances,
      overtime: line.overtime,
      absenceDeduction: line.absenceDeduction,
      otherDeductions: line.otherDeductions,
      grossSalary: line.grossSalary,
      employerInsurance: line.employerInsurance,
      employeeInsurance: line.employeeInsurance,
      tax: line.tax,
      advanceDeduction: line.advanceDeduction,
      netSalary: line.netSalary,
      blockers: [],
    };
  }

  simulateRule(
    formulaExpr: string,
    conditionExpr: string | null,
    sampleCtx: PayrollCalculationContext
  ): { amount: number; skipped: boolean } {
    const vars = { ...sampleCtx.vars };
    if (conditionExpr && !evaluatePayrollCondition(conditionExpr, vars)) {
      return { amount: 0, skipped: true };
    }
    const amount = evaluatePayrollExpression(formulaExpr, vars);
    return { amount, skipped: false };
  }

  private aggregateToPayrollRunItem(
    employeeId: string,
    components: CalculatedComponentLine[],
    vars: Record<string, number>,
    blockers: string[]
  ): EmployeePayrollCalculationResult {
    const sumType = (type: string, codes?: string[]) =>
      components
        .filter((c) => c.componentType === type && (!codes || codes.includes(c.componentCode)))
        .reduce((s, c) => s + c.amount, 0);

    const basicSalary = vars.comp_basic ?? components.find((c) => c.componentCode === 'BASIC')?.amount ?? 0;
    const allowances =
      (vars.comp_fixed_allowances ?? 0) +
      sumType('EARNING', undefined) -
      basicSalary -
      (vars.comp_overtime ?? components.find((c) => c.componentCode === 'OVERTIME')?.amount ?? 0);

    const overtime = vars.comp_overtime ?? components.find((c) => c.componentCode === 'OVERTIME')?.amount ?? 0;
    const absenceDeduction =
      vars.comp_absence ?? components.find((c) => c.componentCode === 'ABSENCE')?.amount ?? 0;
    const employeeInsurance =
      vars.comp_social_insurance_ee ??
      components.find((c) => c.componentCode === 'SOCIAL_INSURANCE_EE')?.amount ??
      0;
    const employerInsurance =
      vars.comp_social_insurance_er ??
      components.find((c) => c.componentCode === 'SOCIAL_INSURANCE_ER')?.amount ??
      0;
    const tax = vars.comp_tax ?? components.find((c) => c.componentCode === 'TAX')?.amount ?? 0;
    const advanceDeduction =
      vars.comp_advance_recovery ??
      components.find((c) => c.componentCode === 'ADVANCE_RECOVERY')?.amount ??
      vars.advance_due ??
      0;

    const earnings = sumType('EARNING');
    const deductions = sumType('DEDUCTION');
    const grossSalary = roundTo4(earnings > 0 ? earnings : basicSalary + allowances + overtime - absenceDeduction);
    const otherDeductions = roundTo4(
      deductions - employeeInsurance - tax - advanceDeduction - absenceDeduction
    );
    const netSalary = roundTo4(grossSalary - employeeInsurance - tax - advanceDeduction - Math.max(0, otherDeductions));

    return {
      employeeId,
      components,
      basicSalary: roundTo4(basicSalary),
      allowances: roundTo4(Math.max(0, allowances)),
      overtime: roundTo4(overtime),
      absenceDeduction: roundTo4(absenceDeduction),
      otherDeductions: roundTo4(Math.max(0, otherDeductions)),
      grossSalary,
      employerInsurance: roundTo4(employerInsurance),
      employeeInsurance: roundTo4(employeeInsurance),
      tax: roundTo4(tax),
      advanceDeduction: roundTo4(advanceDeduction),
      netSalary,
      blockers,
    };
  }

  private friendlyExplanation(
    code: string,
    amount: number,
    ctx: PayrollCalculationContext,
    rule: LoadedRule
  ): string {
    if (code === 'OVERTIME') {
      return `Overtime: ${ctx.time.approvedOvertimeMinutes} approved minutes × rule ${rule.code} = ${amount}`;
    }
    if (code === 'UNPAID_LEAVE') {
      return `Unpaid leave: ${ctx.leave.unpaidLeaveMinutes} minutes → deduction ${amount}`;
    }
    if (code === 'BONUS') {
      return `Bonus: approved one-time input = ${amount}`;
    }
    if (code === 'ADVANCE_RECOVERY') {
      return `Advance recovery (FIFO preview) = ${amount}`;
    }
    return `${code}: rule ${rule.code} = ${amount}`;
  }

  private applyRounding(amount: number, mode: string): number {
    if (mode === 'HALF_UP_4') return roundTo4(amount);
    return roundTo4(Math.round(amount * 100) / 100);
  }
}

export const payrollRuleEngineService = new PayrollRuleEngineService();
