import prisma from '../../../../shared/database/prisma';
import { AppError } from '../../../../shared/middleware/error-handler';
import { evaluatePayrollExpression } from './payroll-expression.evaluator';
import { orderPayrollRules } from './payroll-rule-graph.domain';

export type RuleValidationResult = {
  valid: boolean;
  errors: string[];
  dependencies: string[];
};

export class PayrollRuleAdminService {
  validateRuleInput(input: {
    formulaExpr: string;
    conditionExpr?: string | null;
    dependsOnCodes?: string[];
    payComponentId?: string;
    code?: string;
    effectiveFrom?: Date;
    effectiveTo?: Date | null;
  }): RuleValidationResult {
    const errors: string[] = [];
    try {
      evaluatePayrollExpression(input.formulaExpr, { comp_basic: 1, period_days: 30 });
    } catch (e) {
      errors.push(e instanceof Error ? e.message : 'Invalid formula');
    }
    if (input.conditionExpr) {
      try {
        evaluatePayrollExpression(input.conditionExpr, { comp_basic: 1, period_days: 30 });
      } catch (e) {
        errors.push(`Condition: ${e instanceof Error ? e.message : 'invalid'}`);
      }
    }
    const dependencies = input.dependsOnCodes ?? [];
    return { valid: errors.length === 0, errors, dependencies };
  }

  async validateAndCheckGraph(companyId: string, draft: {
    code: string;
    payComponentId: string;
    formulaExpr: string;
    conditionExpr?: string | null;
    dependsOnCodes?: string[];
    phase: number;
    priority: number;
  }): Promise<RuleValidationResult> {
    const base = this.validateRuleInput(draft);
    if (!base.valid) return base;
    const component = await prisma.hcmPayComponent.findFirst({
      where: { id: draft.payComponentId, companyId },
    });
    if (!component) base.errors.push('Invalid pay component');
    const allRules = await prisma.hcmPayrollRule.findMany({
      where: { companyId },
      include: { payComponent: { select: { code: true } } },
    });
    const graph = [
      ...allRules.map((r) => ({
        code: r.code,
        componentCode: r.payComponent.code,
        phase: r.phase,
        priority: r.priority,
        dependsOn: r.dependsOnCodes ? (JSON.parse(r.dependsOnCodes) as string[]) : [],
      })),
      {
        code: draft.code,
        componentCode: component!.code,
        phase: draft.phase,
        priority: draft.priority,
        dependsOn: draft.dependsOnCodes ?? [],
      },
    ];
    try {
      orderPayrollRules(graph);
    } catch (e) {
      base.errors.push(e instanceof Error ? e.message : 'Rule dependency cycle');
      base.valid = false;
    }
    return base;
  }

  async listVersions(companyId: string, code: string) {
    return prisma.hcmPayrollRule.findMany({
      where: { companyId, code },
      orderBy: [{ effectiveFrom: 'desc' }],
      include: { payComponent: { select: { code: true } } },
    });
  }

  async updateRule(
    companyId: string,
    ruleId: string,
    data: Partial<{
      name: string;
      phase: number;
      priority: number;
      effectiveFrom: Date;
      effectiveTo: Date | null;
      conditionExpr: string | null;
      formulaExpr: string;
      dependsOnCodes: string[];
      isActive: boolean;
    }>
  ) {
    const row = await prisma.hcmPayrollRule.findFirst({ where: { id: ruleId, companyId } });
    if (!row) throw new AppError(404, 'Rule not found');
    const used = await prisma.hcmPayrollItemComponent.findFirst({
      where: { ruleId: row.id },
    });
    if (used && (data.formulaExpr || data.conditionExpr)) {
      throw new AppError(422, 'Historical payroll references this rule; create a new effective-dated version');
    }
    if (data.formulaExpr) {
      evaluatePayrollExpression(data.formulaExpr, { comp_basic: 1, period_days: 30 });
    }
    return prisma.hcmPayrollRule.update({
      where: { id: ruleId },
      data: {
        ...data,
        dependsOnCodes: data.dependsOnCodes ? JSON.stringify(data.dependsOnCodes) : undefined,
      },
    });
  }
}

export const payrollRuleAdminService = new PayrollRuleAdminService();
