import prisma from '../../../../shared/database/prisma';
import { AppError } from '../../../../shared/middleware/error-handler';
import { evaluatePayrollCondition, evaluatePayrollExpression } from './payroll-expression.evaluator';
import { orderPayrollRules } from './payroll-rule-graph.domain';

export type RuleValidationResult = {
  valid: boolean;
  errors: string[];
  dependencies: string[];
};

function parseDepends(raw: string | null): string[] {
  if (!raw) return [];
  try {
    return JSON.parse(raw) as string[];
  } catch {
    return [];
  }
}

export class PayrollRuleAdminService {
  async isRuleFrozen(ruleId: string): Promise<boolean> {
    const used = await prisma.hcmPayrollItemComponent.findFirst({ where: { ruleId } });
    return Boolean(used);
  }

  async assertEffectiveRange(effectiveFrom: Date, effectiveTo: Date | null | undefined) {
    if (effectiveTo && effectiveTo < effectiveFrom) {
      throw new AppError(422, 'effectiveTo must be after effectiveFrom');
    }
  }

  async assertNoOverlappingVersions(
    companyId: string,
    code: string,
    effectiveFrom: Date,
    effectiveTo: Date | null | undefined,
    excludeId?: string
  ) {
    const rangeEnd = effectiveTo ?? new Date('9999-12-31');
    const overlap = await prisma.hcmPayrollRule.findFirst({
      where: {
        companyId,
        code,
        ...(excludeId ? { id: { not: excludeId } } : {}),
        NOT: {
          OR: [{ effectiveTo: { lt: effectiveFrom } }, { effectiveFrom: { gt: rangeEnd } }],
        },
      },
    });
    if (overlap) {
      throw new AppError(422, 'Rule version overlaps an existing effective period');
    }
  }

  async getRuleById(companyId: string, ruleId: string) {
    const row = await prisma.hcmPayrollRule.findFirst({
      where: { id: ruleId, companyId },
      include: { payComponent: { select: { id: true, code: true, componentType: true } } },
    });
    if (!row) throw new AppError(404, 'Rule not found');
    const frozen = await this.isRuleFrozen(row.id);
    return {
      ...row,
      dependsOnCodes: parseDepends(row.dependsOnCodes),
      frozen,
      minAmount: row.minAmount != null ? Number(row.minAmount) : null,
      maxAmount: row.maxAmount != null ? Number(row.maxAmount) : null,
    };
  }

  async createRule(
    companyId: string,
    input: {
      payComponentId: string;
      code: string;
      name: string;
      phase: number;
      priority: number;
      effectiveFrom: Date;
      effectiveTo?: Date | null;
      conditionExpr?: string | null;
      formulaExpr: string;
      roundingMode?: string;
      minAmount?: number | null;
      maxAmount?: number | null;
      dependsOnCodes?: string[];
      localizationKey?: string | null;
      isActive?: boolean;
    }
  ) {
    await this.assertEffectiveRange(input.effectiveFrom, input.effectiveTo);
    await this.assertNoOverlappingVersions(
      companyId,
      input.code,
      input.effectiveFrom,
      input.effectiveTo
    );
    const validation = await this.validateAndCheckGraph(companyId, {
      code: input.code,
      payComponentId: input.payComponentId,
      formulaExpr: input.formulaExpr,
      conditionExpr: input.conditionExpr ?? null,
      dependsOnCodes: input.dependsOnCodes ?? [],
      phase: input.phase,
      priority: input.priority,
    });
    if (!validation.valid) {
      throw new AppError(422, validation.errors.join('; ') || 'Invalid rule');
    }
    evaluatePayrollExpression(input.formulaExpr, { comp_basic: 1, period_days: 30 });
    return prisma.hcmPayrollRule.create({
      data: {
        companyId,
        payComponentId: input.payComponentId,
        code: input.code,
        name: input.name,
        phase: input.phase,
        priority: input.priority,
        effectiveFrom: input.effectiveFrom,
        effectiveTo: input.effectiveTo ?? null,
        conditionExpr: input.conditionExpr ?? null,
        formulaExpr: input.formulaExpr,
        roundingMode: input.roundingMode ?? 'HALF_UP_2',
        minAmount: input.minAmount ?? null,
        maxAmount: input.maxAmount ?? null,
        dependsOnCodes: input.dependsOnCodes?.length ? JSON.stringify(input.dependsOnCodes) : null,
        localizationKey: input.localizationKey ?? null,
        isActive: input.isActive !== false,
      },
    });
  }

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
        evaluatePayrollCondition(input.conditionExpr, { comp_basic: 1, period_days: 30 });
      } catch (e) {
        errors.push(`Condition: ${e instanceof Error ? e.message : 'invalid'}`);
      }
    }
    const dependencies = [...(input.dependsOnCodes ?? [])];
    if (input.effectiveFrom && input.effectiveTo && input.effectiveTo < input.effectiveFrom) {
      errors.push('effectiveTo must be after effectiveFrom');
    }
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
      ...allRules
        .filter((r) => r.code !== draft.code)
        .map((r) => ({
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
      roundingMode: string;
      minAmount: number | null;
      maxAmount: number | null;
      localizationKey: string | null;
      isActive: boolean;
    }>
  ) {
    const row = await prisma.hcmPayrollRule.findFirst({ where: { id: ruleId, companyId } });
    if (!row) throw new AppError(404, 'Rule not found');
    const frozen = await this.isRuleFrozen(row.id);
    if (frozen && (data.formulaExpr || data.conditionExpr)) {
      throw new AppError(422, 'Historical payroll references this rule; create a new effective-dated version');
    }
    const nextFrom = data.effectiveFrom ?? row.effectiveFrom;
    const nextTo = data.effectiveTo !== undefined ? data.effectiveTo : row.effectiveTo;
    await this.assertEffectiveRange(nextFrom, nextTo);
    if (data.effectiveFrom || data.effectiveTo !== undefined) {
      await this.assertNoOverlappingVersions(companyId, row.code, nextFrom, nextTo, ruleId);
    }
    if (data.formulaExpr) {
      evaluatePayrollExpression(data.formulaExpr, { comp_basic: 1, period_days: 30 });
    }
    return prisma.hcmPayrollRule.update({
      where: { id: ruleId },
      data: {
        name: data.name,
        phase: data.phase,
        priority: data.priority,
        effectiveFrom: data.effectiveFrom,
        effectiveTo: data.effectiveTo,
        conditionExpr: data.conditionExpr,
        formulaExpr: data.formulaExpr,
        roundingMode: data.roundingMode,
        minAmount: data.minAmount,
        maxAmount: data.maxAmount,
        localizationKey: data.localizationKey,
        isActive: data.isActive,
        dependsOnCodes: data.dependsOnCodes ? JSON.stringify(data.dependsOnCodes) : undefined,
      },
    });
  }
}

export const payrollRuleAdminService = new PayrollRuleAdminService();
