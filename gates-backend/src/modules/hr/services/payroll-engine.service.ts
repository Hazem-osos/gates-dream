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

    const basic = Number(employee.basicSalary ?? 0);
    const allowances = Number(employee.fixedAllowances ?? 0);
    const overtime = input.overtime ?? 0;
    const absenceDeduction = input.absenceDeduction ?? 0;
    const otherDeductions = input.otherDeductions ?? 0;

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

  async createPayrollRun(
    companyId: string,
    params: {
      branchId?: string;
      fiscalYearId?: string;
      periodMonth: number;
      periodYear: number;
      employeeInputs?: Record<string, EmployeePayrollInput>;
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
    if (existing && existing.status !== 'DRAFT') {
      throw new AppError(409, 'Payroll run already posted for this period');
    }
    if (existing) {
      await prisma.payrollRunItem.deleteMany({ where: { payrollRunId: existing.id } });
      await prisma.payrollRun.delete({ where: { id: existing.id } });
    }

    const employees = await prisma.employee.findMany({
      where: {
        companyId,
        isActive: true,
        basicSalary: { gt: 0 },
      },
    });
    if (employees.length === 0) {
      throw new AppError(422, 'No active employees with basic salary configured');
    }

    const lines: CalculatedPayrollLine[] = [];
    for (const emp of employees) {
      const input = params.employeeInputs?.[emp.id] ?? {};
      lines.push(await this.calculateEmployeePayroll(companyId, emp.id, input));
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

    return prisma.payrollRun.create({
      data: {
        companyId,
        branchId: params.branchId,
        fiscalYearId: params.fiscalYearId,
        periodMonth: params.periodMonth,
        periodYear: params.periodYear,
        status: 'DRAFT',
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
          })),
        },
      },
      include: { items: true },
    });
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
