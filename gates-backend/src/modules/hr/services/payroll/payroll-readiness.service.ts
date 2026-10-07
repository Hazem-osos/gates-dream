import prisma from '../../../../shared/database/prisma';
import { payrollContextBuilderService } from './payroll-context-builder.service';
import { payrollEngineModeService } from './payroll-engine-mode.service';
import { PAYROLL_CALCULATION_MODES } from './payroll-calculation-strategy.domain';

export type ReadinessResult = {
  ready: boolean;
  blockers: string[];
  warnings: string[];
};

export class PayrollReadinessService {
  async checkEmployee(
    companyId: string,
    employeeId: string,
    periodYear: number,
    periodMonth: number,
    options?: { requireTimeReady?: boolean }
  ): Promise<ReadinessResult> {
    const blockers: string[] = [];
    const warnings: string[] = [];

    const employee = await prisma.employee.findFirst({
      where: { id: employeeId, companyId, isActive: true },
    });
    if (!employee) {
      blockers.push('Employee not found or inactive');
      return { ready: false, blockers, warnings };
    }

    const employment = await prisma.hcmEmployment.findFirst({
      where: { companyId, employeeId, status: 'ACTIVE' },
    });
    if (!employment) {
      warnings.push('No HCM active employment — using legacy employee salary fields');
    }

    const basic = Number(employee.basicSalary ?? 0);
    if (basic <= 0) {
      blockers.push('Missing basic salary');
    }

    const periodEnd = new Date(Date.UTC(periodYear, periodMonth, 0));
    const mode = await payrollEngineModeService.getConfiguredMode(companyId);
    if (mode === PAYROLL_CALCULATION_MODES.RULE_ENGINE) {
      try {
        await payrollEngineModeService.resolveForCalculation(companyId, periodEnd);
      } catch {
        blockers.push('MISSING_RULE');
      }
    }

    if (options?.requireTimeReady) {
      try {
        const ctx = await payrollContextBuilderService.buildEmployeeContext(
          companyId,
          employeeId,
          periodYear,
          periodMonth
        );
        if (!ctx.time.readyForPayroll) {
          blockers.push('TIME_NOT_READY');
        }
        if ((ctx.time.unresolvedExceptionCount ?? 0) > 0) {
          blockers.push('UNRESOLVED_TIME_EXCEPTION');
        }
      } catch (e) {
        blockers.push(e instanceof Error ? e.message : 'TIME_NOT_READY');
      }
    }

    if (Number(employee.basicSalary ?? 0) <= 0 && mode === PAYROLL_CALCULATION_MODES.LEGACY_COMPATIBILITY) {
      blockers.push('NO_COMPENSATION');
    }

    return { ready: blockers.length === 0, blockers, warnings };
  }
}

export const payrollReadinessService = new PayrollReadinessService();
