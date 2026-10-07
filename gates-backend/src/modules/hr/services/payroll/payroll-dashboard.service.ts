import prisma from '../../../../shared/database/prisma';
import { roundTo4 } from '../../../../shared/utils/decimal-round';
import { payrollGlMappingService } from './payroll-gl-mapping.service';
import { payrollEngineModeService } from './payroll-engine-mode.service';

export class PayrollDashboardService {
  async getMetrics(companyId: string, periodYear: number, periodMonth: number) {
    const [run, employeeCount, settings, mode] = await Promise.all([
      prisma.payrollRun.findUnique({
        where: { companyId_periodYear_periodMonth: { companyId, periodYear, periodMonth } },
        include: { items: { include: { components: true } } },
      }),
      prisma.employee.count({ where: { companyId, isActive: true, basicSalary: { gt: 0 } } }),
      prisma.hrSettings.findUnique({ where: { companyId } }),
      payrollEngineModeService.getConfiguredMode(companyId),
    ]);

    let gross = 0;
    let deductions = 0;
    let employer = 0;
    let net = 0;
    let blockedEmployees = 0;
    const componentCodes = new Set<string>();

    if (run) {
      gross = Number(run.totalGross);
      net = Number(run.totalNet);
      for (const item of run.items) {
        if (Number(item.netSalary) < 0) blockedEmployees += 1;
        for (const c of item.components) {
          componentCodes.add(c.componentCode);
          const amt = Number(c.amount);
          if (c.componentType === 'DEDUCTION') deductions += amt;
          if (c.componentType === 'EMPLOYER_CONTRIBUTION') employer += amt;
        }
      }
    }

    const glBlockers = run?.items.some((i) => i.components.length)
      ? await payrollGlMappingService.assertMappingsForRun(companyId, [...componentCodes])
      : [];

    return {
      periodYear,
      periodMonth,
      payrollEngineMode: mode,
      runStatus: run?.status ?? 'NONE',
      calculationMode: run?.calculationMode ?? null,
      employeeCount,
      employeesInRun: run?.items.length ?? 0,
      blockedEmployees,
      gross: roundTo4(gross),
      deductions: roundTo4(deductions),
      employerContributions: roundTo4(employer),
      net: roundTo4(net),
      unpostedPayroll: run && ['APPROVED', 'CALCULATED', 'REVIEWED'].includes(run.status) ? net : 0,
      unpaidPayroll: run && run.status === 'POSTED' ? net : 0,
      missingGlMappings: glBlockers,
      payrollRequireApprovalBeforePost: settings?.payrollRequireApprovalBeforePost ?? false,
    };
  }
}

export const payrollDashboardService = new PayrollDashboardService();
