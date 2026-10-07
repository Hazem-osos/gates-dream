import { Decimal } from '@prisma/client/runtime/library';
import prisma from '../../../shared/database/prisma';
import { AppError } from '../../../shared/middleware/error-handler';
import { roundTo4 } from '../../../shared/utils/decimal-round';
import { hrGlAccountResolverService } from './hr-gl-account-resolver.service';

export interface EmployeePayrollInput {
  overtime?: number;
  absenceDeduction?: number;
  otherDeductions?: number;
}

export interface CalculatedPayrollLine {
  employeeId: string;
  basicSalary: number;
  allowances: number;
  overtime: number;
  absenceDeduction: number;
  otherDeductions: number;
  grossSalary: number;
  employerInsurance: number;
  employeeInsurance: number;
  tax: number;
  advanceDeduction: number;
  netSalary: number;
}

export class PayrollEngineService {
  async calculateEmployeePayroll(
    companyId: string,
    employeeId: string,
    input: EmployeePayrollInput = {}
  ): Promise<CalculatedPayrollLine> {
    const [employee, settings] = await Promise.all([
      prisma.employee.findFirst({
        where: { id: employeeId, companyId, isActive: true },
      }),
      hrGlAccountResolverService.getSettings(companyId),
    ]);
    if (!employee) throw new AppError(404, 'Employee not found');

    const [allowanceMasters, deductionMasters, procedures] = await Promise.all([
      prisma.allowance.findMany({
        where: { companyId, isActive: true },
        select: { defaultAmount: true },
      }),
      prisma.deduction.findMany({
        where: { companyId, isActive: true },
        select: { defaultAmount: true },
      }),
      prisma.employeeProcedure.findMany({
        where: { employeeId, procedureType: { in: ['reward', 'penalty'] } },
        select: { procedureType: true, amount: true },
      }),
    ]);
    const sumAmount = (rows: Array<{ defaultAmount?: { toString(): string } | null }>) =>
      rows.reduce((sum, row) => sum + Number(row.defaultAmount ?? 0), 0);
    const rewardTotal = procedures
      .filter((row) => row.procedureType === 'reward')
      .reduce((sum, row) => sum + Number(row.amount ?? 0), 0);
    const penaltyTotal = procedures
      .filter((row) => row.procedureType === 'penalty')
      .reduce((sum, row) => sum + Number(row.amount ?? 0), 0);

    const basic = Number(employee.basicSalary ?? 0);
    const allowances = Number(employee.fixedAllowances ?? 0) + sumAmount(allowanceMasters) + rewardTotal;
    const overtime = input.overtime ?? 0;
    const absenceDeduction = input.absenceDeduction ?? 0;
    const otherDeductions = (input.otherDeductions ?? 0) + sumAmount(deductionMasters) + penaltyTotal;

    const grossSalary = roundTo4(
      basic + allowances + overtime - absenceDeduction - otherDeductions
    );

    const insuranceBase = roundTo4(basic + allowances);
    let employeeInsurance = 0;
    let employerInsurance = 0;
    if (employee.socialInsuranceEnrolled && insuranceBase > 0) {
      const empRate = Number(settings.employeeInsuranceRate);
      const erRate = Number(settings.employerInsuranceRate);
      employeeInsurance = roundTo4(insuranceBase * empRate);
      employerInsurance = roundTo4(insuranceBase * erRate);
    }

    const exemption = Number(employee.taxExemptionAmount ?? 0);
    const taxRate = Number(settings.payrollTaxFlatRate);
    const taxable = Math.max(0, grossSalary - employeeInsurance - exemption);
    const tax = roundTo4(taxable * taxRate);

    const advanceDeduction = await this.computeAdvanceDeduction(employeeId);
    const netSalary = roundTo4(
      grossSalary - employeeInsurance - tax - advanceDeduction
    );

    return {
      employeeId,
      basicSalary: basic,
      allowances,
      overtime,
      absenceDeduction,
      otherDeductions,
      grossSalary,
      employerInsurance,
      employeeInsurance,
      tax,
      advanceDeduction,
      netSalary,
    };
  }

  private async computeAdvanceDeduction(employeeId: string): Promise<number> {
    const advances = await prisma.employeeAdvance.findMany({
      where: {
        employeeId,
        isActive: true,
        isSettled: false,
      },
    });
    let total = 0;
    for (const adv of advances) {
      const remaining = Number(adv.remainingAmount ?? adv.value);
      if (remaining <= 0) continue;
      const installment = Number(adv.monthlyInstallment ?? remaining);
      total += Math.min(installment, remaining);
    }
    return roundTo4(total);
  }

  /** Canonical run creation — delegates to Phase 5 calculation + snapshot layer. */
  async createPayrollRun(
    companyId: string,
    params: {
      branchId?: string;
      fiscalYearId?: string;
      periodMonth: number;
      periodYear: number;
      employeeInputs?: Record<string, EmployeePayrollInput>;
      calculatedById?: string;
    }
  ) {
    const { payrollRunCalculationService } = await import('./payroll/payroll-run-calculation.service');
    return payrollRunCalculationService.createPayrollRun(companyId, params);
  }

  async getPayrollRun(companyId: string, id: string) {
    const run = await prisma.payrollRun.findFirst({
      where: { id, companyId },
      include: { items: { include: { employee: { select: { id: true, arabicName: true } } } } },
    });
    if (!run) throw new AppError(404, 'Payroll run not found');
    return run;
  }
}

export const payrollEngineService = new PayrollEngineService();
