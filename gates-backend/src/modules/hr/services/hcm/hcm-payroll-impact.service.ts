import prisma from '../../../../shared/database/prisma';
import { toDateOnly } from '../../utils/hr-effective-date.util';

export type PayrollImpactReport = {
  impacted: boolean;
  requiresPayrollAdjustment: boolean;
  periods: Array<{ periodYear: number; periodMonth: number; status: string; payrollRunId: string }>;
  message?: string;
};

/** Read-only: backdated HR changes vs posted/paid payroll (does not mutate payroll). */
export class HcmPayrollImpactService {
  async detectImpactForEmployee(
    companyId: string,
    employeeId: string,
    effectiveFrom: Date,
    effectiveTo?: Date | null
  ): Promise<PayrollImpactReport> {
    const from = toDateOnly(effectiveFrom);
    const to = effectiveTo ? toDateOnly(effectiveTo) : from;

    const runs = await prisma.payrollRun.findMany({
      where: {
        companyId,
        status: { in: ['POSTED', 'PAID'] },
      },
      include: {
        items: { where: { employeeId }, select: { id: true } },
      },
    });

    const periods: PayrollImpactReport['periods'] = [];
    for (const run of runs) {
      if (run.items.length === 0) continue;
      const periodStart = new Date(Date.UTC(run.periodYear, run.periodMonth - 1, 1));
      const periodEnd = new Date(Date.UTC(run.periodYear, run.periodMonth, 0));
      if (periodEnd.getTime() < from.getTime() || periodStart.getTime() > to.getTime()) continue;
      periods.push({
        periodYear: run.periodYear,
        periodMonth: run.periodMonth,
        status: run.status,
        payrollRunId: run.id,
      });
    }

    const impacted = periods.length > 0;
    return {
      impacted,
      requiresPayrollAdjustment: impacted,
      periods,
      message: impacted
        ? 'Backdated change intersects posted/paid payroll; historical payroll will not be recalculated automatically.'
        : undefined,
    };
  }
}

export const hcmPayrollImpactService = new HcmPayrollImpactService();
