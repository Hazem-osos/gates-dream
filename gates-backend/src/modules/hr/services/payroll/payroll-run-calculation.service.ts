import { Prisma } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import prisma from '../../../../shared/database/prisma';
import { AppError } from '../../../../shared/middleware/error-handler';
import { roundTo4 } from '../../../../shared/utils/decimal-round';
import type { EmployeePayrollInput } from '../payroll-engine.service';
import { payrollContextBuilderService } from './payroll-context-builder.service';
import { payrollReadinessService } from './payroll-readiness.service';
import { payrollRuleEngineService } from './payroll-rule-engine.service';
import { payrollEngineModeService } from './payroll-engine-mode.service';
import { payrollGlMappingService } from './payroll-gl-mapping.service';
import type { EmployeePayrollCalculationResult } from './payroll-calculation.types';
import { PAYROLL_CALCULATION_MODES } from './payroll-calculation-strategy.domain';

export type PayrollRunPreview = {
  periodYear: number;
  periodMonth: number;
  engineMode: string;
  totalEmployees: number;
  included: number;
  excluded: number;
  ready: number;
  blocked: number;
  blockers: Array<{
    employeeId: string;
    employeeName?: string;
    serial?: string | null;
    category: string;
    messages: string[];
  }>;
  totals: {
    gross: number;
    net: number;
    deductions: number;
    employerContributions: number;
  };
};

export class PayrollRunCalculationService {
  async previewRun(
    companyId: string,
    periodYear: number,
    periodMonth: number
  ): Promise<PayrollRunPreview> {
    const periodEnd = new Date(Date.UTC(periodYear, periodMonth, 0));
    const engineMode = await payrollEngineModeService.resolveForCalculation(companyId, periodEnd);
    const employees = await this.listPayrollEmployees(companyId);
    const blockers: PayrollRunPreview['blockers'] = [];
    let gross = 0;
    let net = 0;
    let employerContributions = 0;
    let included = 0;

    for (const emp of employees) {
      const readiness = await payrollReadinessService.checkEmployee(
        companyId,
        emp.id,
        periodYear,
        periodMonth
      );
      if (readiness.blockers.length) {
        blockers.push({
          employeeId: emp.id,
          employeeName: emp.arabicName,
          serial: emp.serial,
          category: readiness.blockers[0]?.split(':')[0] ?? 'READINESS',
          messages: readiness.blockers,
        });
        continue;
      }
      included++;
      try {
        const result = await this.calculateEmployee(companyId, emp.id, periodYear, periodMonth);
        gross += result.grossSalary;
        net += result.netSalary;
        employerContributions += result.employerInsurance;
      } catch (e) {
        blockers.push({
          employeeId: emp.id,
          employeeName: emp.arabicName,
          serial: emp.serial,
          category: 'CALCULATION',
          messages: [e instanceof Error ? e.message : 'Calculation failed'],
        });
        included--;
      }
    }

    return {
      periodYear,
      periodMonth,
      engineMode,
      totalEmployees: employees.length,
      included,
      excluded: employees.length - included,
      ready: included,
      blocked: employees.length - included,
      blockers,
      totals: {
        gross: roundTo4(gross),
        net: roundTo4(net),
        deductions: roundTo4(gross - net),
        employerContributions: roundTo4(employerContributions),
      },
    };
  }

  async calculateEmployee(
    companyId: string,
    employeeId: string,
    periodYear: number,
    periodMonth: number,
    manualInput?: EmployeePayrollInput
  ): Promise<EmployeePayrollCalculationResult> {
    const periodEnd = new Date(Date.UTC(periodYear, periodMonth, 0));
    const mode = await payrollEngineModeService.resolveForCalculation(companyId, periodEnd);
    const requireTime =
      mode === PAYROLL_CALCULATION_MODES.RULE_ENGINE &&
      (await payrollEngineModeService.requireTimeReady(companyId));
    const ctx = await payrollContextBuilderService.buildEmployeeContext(
      companyId,
      employeeId,
      periodYear,
      periodMonth,
      { requireTimeReady: requireTime }
    );

    if (mode === PAYROLL_CALCULATION_MODES.RULE_ENGINE) {
      const rules = await payrollRuleEngineService.loadRules(companyId, periodEnd);
      return payrollRuleEngineService.calculateWithRules(ctx, rules);
    }

    return payrollRuleEngineService.calculateLegacy(companyId, ctx, manualInput);
  }

  async createPayrollRun(
    companyId: string,
    params: {
      branchId?: string;
      fiscalYearId?: string;
      periodMonth: number;
      periodYear: number;
      employeeInputs?: Record<string, EmployeePayrollInput>;
      calculatedById?: string;
      requireTimeReady?: boolean;
    }
  ) {
    const existing = await prisma.payrollRun.findUnique({
      where: {
        companyId_periodYear_periodMonth: {
          companyId,
          periodYear: params.periodYear,
          periodMonth: params.periodMonth,
        },
      },
    });
    if (existing && !['DRAFT', 'CALCULATED'].includes(existing.status)) {
      throw new AppError(409, 'Payroll run already posted for this period');
    }

    const employees = await this.listPayrollEmployees(companyId);
    if (employees.length === 0) {
      throw new AppError(422, 'No active employees with basic salary configured');
    }

    const periodStart = new Date(Date.UTC(params.periodYear, params.periodMonth - 1, 1));
    const periodEnd = new Date(Date.UTC(params.periodYear, params.periodMonth, 0));
    const mode = await payrollEngineModeService.resolveForCalculation(companyId, periodEnd);
    const fingerprint = await payrollRuleEngineService.fingerprintRules(companyId, periodEnd);
    const glMap = await payrollGlMappingService.resolveComponentMappings(companyId);

    const lines: EmployeePayrollCalculationResult[] = [];
    const snapshotEmployees: Record<string, unknown> = {};
    const snapshotOneTimeInputIds = new Set<string>();
    const runBlockers: string[] = [];

    for (const emp of employees) {
      const readiness = await payrollReadinessService.checkEmployee(
        companyId,
        emp.id,
        params.periodYear,
        params.periodMonth,
        {
          requireTimeReady:
            params.requireTimeReady ??
            (mode === PAYROLL_CALCULATION_MODES.RULE_ENGINE &&
              (await payrollEngineModeService.requireTimeReady(companyId))),
        }
      );
      if (readiness.blockers.length) {
        runBlockers.push(`${emp.id}: ${readiness.blockers.join('; ')}`);
        continue;
      }
      const input = params.employeeInputs?.[emp.id] ?? {};
      const result = await this.calculateEmployee(
        companyId,
        emp.id,
        params.periodYear,
        params.periodMonth,
        input
      );
      lines.push(result);
      const ctx = await payrollContextBuilderService.buildEmployeeContext(
        companyId,
        emp.id,
        params.periodYear,
        params.periodMonth
      );
      for (const id of ctx.oneTimeInputIds) snapshotOneTimeInputIds.add(id);
      snapshotEmployees[emp.id] = {
        employee: ctx.employee,
        compensation: ctx.compensation,
        time: ctx.time,
        leave: ctx.leave,
        advances: ctx.advances,
        inputs: ctx.inputs,
        oneTimeInputIds: ctx.oneTimeInputIds,
        statutory: ctx.statutory,
      };
    }

    if (lines.length === 0) {
      throw new AppError(422, runBlockers.join(' | ') || 'No employees calculated');
    }

    const hrSettings = await prisma.hrSettings.findUnique({ where: { companyId } });
    const negativePolicy = hrSettings?.payrollNegativeNetPolicy ?? 'BLOCK';
    if (negativePolicy === 'CARRY_FORWARD_DEDUCTION') {
      throw new AppError(422, 'NEGATIVE_NET_POLICY_UNSUPPORTED:CARRY_FORWARD_DEDUCTION');
    }
    const negativeLines = lines.filter((l) => l.netSalary < 0);
    if (negativePolicy === 'BLOCK' && negativeLines.length > 0) {
      throw new AppError(422, 'NEGATIVE_NET_BLOCKED');
    }

    const totals = lines.reduce(
      (acc, line) => ({
        totalGross: acc.totalGross + line.grossSalary,
        totalNet: acc.totalNet + line.netSalary,
        totalEmployerInsurance: acc.totalEmployerInsurance + line.employerInsurance,
        totalEmployeeInsurance: acc.totalEmployeeInsurance + line.employeeInsurance,
        totalTax: acc.totalTax + line.tax,
        totalAdvanceDeduction: acc.totalAdvanceDeduction + line.advanceDeduction,
      }),
      {
        totalGross: 0,
        totalNet: 0,
        totalEmployerInsurance: 0,
        totalEmployeeInsurance: 0,
        totalTax: 0,
        totalAdvanceDeduction: 0,
      }
    );

    const calcLock = `hcm:payroll:calc:${companyId}:${params.periodYear}:${params.periodMonth}`;
    return prisma.$transaction(async (tx) => {
      const lockRows = await tx.$queryRaw<{ r: number | null }[]>`
        SELECT GET_LOCK(${calcLock}, 30) AS r`;
      if (Number(lockRows[0]?.r) !== 1) {
        throw new AppError(409, 'PAYROLL_CALCULATE_LOCKED');
      }
      if (existing) {
        await tx.hcmPayrollItemComponent.deleteMany({
          where: { payrollRunItem: { payrollRunId: existing.id } },
        });
        await tx.hcmPayrollRunSnapshot.deleteMany({ where: { payrollRunId: existing.id } });
        await tx.payrollRunItem.deleteMany({ where: { payrollRunId: existing.id } });
        await tx.payrollRun.delete({ where: { id: existing.id } });
      }

      const run = await tx.payrollRun.create({
        data: {
          companyId,
          branchId: params.branchId,
          fiscalYearId: params.fiscalYearId,
          periodMonth: params.periodMonth,
          periodYear: params.periodYear,
          periodStartDate: periodStart,
          periodEndDate: periodEnd,
          status: 'CALCULATED',
          calculationMode: mode,
          calculatedAt: new Date(),
          calculatedById: params.calculatedById,
          totalGross: new Decimal(roundTo4(totals.totalGross)),
          totalNet: new Decimal(roundTo4(totals.totalNet)),
          totalEmployerInsurance: new Decimal(roundTo4(totals.totalEmployerInsurance)),
          totalEmployeeInsurance: new Decimal(roundTo4(totals.totalEmployeeInsurance)),
          totalTax: new Decimal(roundTo4(totals.totalTax)),
          totalAdvanceDeduction: new Decimal(roundTo4(totals.totalAdvanceDeduction)),
          items: {
            create: lines.map((line) => ({
              employeeId: line.employeeId,
              basicSalary: new Decimal(line.basicSalary),
              allowances: new Decimal(line.allowances),
              overtime: new Decimal(line.overtime),
              absenceDeduction: new Decimal(line.absenceDeduction),
              otherDeductions: new Decimal(line.otherDeductions),
              grossSalary: new Decimal(line.grossSalary),
              employerInsurance: new Decimal(line.employerInsurance),
              employeeInsurance: new Decimal(line.employeeInsurance),
              tax: new Decimal(line.tax),
              advanceDeduction: new Decimal(line.advanceDeduction),
              netSalary: new Decimal(line.netSalary),
              components: {
                create: line.components.map((c) => {
                  const gl = glMap.get(c.componentCode);
                  return {
                    payComponentId: c.payComponentId,
                    componentCode: c.componentCode,
                    componentType: c.componentType,
                    phase: c.phase,
                    amount: new Decimal(c.amount),
                    quantity: c.quantity != null ? new Decimal(c.quantity) : undefined,
                    baseAmount: c.baseAmount != null ? new Decimal(c.baseAmount) : undefined,
                    rate: c.rate != null ? new Decimal(c.rate) : undefined,
                    ruleCode: c.ruleCode,
                    ruleId: c.ruleId,
                    ruleFingerprint: c.ruleFingerprint,
                    ruleFormulaFingerprint: c.ruleFormulaFingerprint,
                    roundingMode: c.roundingMode,
                    branchIdSnapshot: c.branchIdSnapshot ?? undefined,
                    departmentIdSnapshot: c.departmentIdSnapshot ?? undefined,
                    costCenterIdSnapshot: c.costCenterIdSnapshot ?? undefined,
                    glExpenseAccountIdSnapshot:
                      c.glExpenseAccountIdSnapshot ?? gl?.expenseAccountId ?? undefined,
                    glPayableAccountIdSnapshot:
                      c.glPayableAccountIdSnapshot ?? gl?.payableAccountId ?? undefined,
                    sourceType: c.sourceType,
                    sourceRef: c.sourceRef,
                    explanation:
                      c.explanation != null ? (c.explanation as Prisma.InputJsonValue) : undefined,
                  };
                }),
              },
            })) as unknown as Prisma.PayrollRunItemCreateWithoutPayrollRunInput[],
          },
        },
        include: { items: { include: { components: true } } },
      });

      await tx.hcmPayrollRunSnapshot.create({
        data: {
          payrollRunId: run.id,
          ruleSetFingerprint: fingerprint,
          inputSnapshot: {
            period: {
              year: params.periodYear,
              month: params.periodMonth,
              start: periodStart.toISOString().slice(0, 10),
              end: periodEnd.toISOString().slice(0, 10),
            },
            employees: snapshotEmployees,
            oneTimeInputIds: [...snapshotOneTimeInputIds],
            calculationMode: mode,
            ruleSetFingerprint: fingerprint,
          } as Prisma.InputJsonValue,
        },
      });

      await tx.$executeRaw`SELECT RELEASE_LOCK(${calcLock})`;
      return run;
    });
  }

  private async listPayrollEmployees(companyId: string) {
    return prisma.employee.findMany({
      where: {
        companyId,
        isActive: true,
        basicSalary: { gt: 0 },
      },
    });
  }
}

export const payrollRunCalculationService = new PayrollRunCalculationService();
