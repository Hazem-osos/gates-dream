import { z } from 'zod';
import prisma from '../../../shared/database/prisma';
import { BaseAiTool } from './base-ai-tool';
import { periodRange } from './period-range';
import type { SecurityContext } from './types';

const paramsSchema = z.object({
  costCenterId: z.string().uuid().optional(),
  query: z.string().trim().min(1).max(120).optional(),
});

type Params = z.infer<typeof paramsSchema>;

export type CostCenterReportPort = {
  getCostCenterReport: (params: {
    companyId: string;
    branchId?: string;
    fiscalYearId?: string;
    startDate: Date;
    endDate: Date;
  }) => Promise<{
    centers: Array<{
      costCenterId: string | null;
      code: string | null;
      arabicName: string | null;
      totalDebit: number;
      totalCredit: number;
      net: number;
    }>;
  }>;
};

export class CostCenterProjectsTool extends BaseAiTool<Params> {
  readonly name = 'cost_center_projects_tool';
  readonly description =
    'Cost-center / project performance: attributed revenue, expenses, and net margin for the current year.';
  readonly parameters = paramsSchema;
  readonly requiredPermission = 'cost-center:view';
  readonly requiredPermissions = ['cost-center:view', 'project:view', 'report:view'];

  constructor(private readonly reports: CostCenterReportPort) {
    super();
  }

  protected async run(params: Params, context: SecurityContext) {
    const { start, end } = periodRange('this_year');
    const report = await this.reports.getCostCenterReport({
      companyId: context.companyId,
      branchId: context.branchId,
      fiscalYearId: context.fiscalYearId,
      startDate: start,
      endDate: end,
    });

    let centers = report.centers;
    if (params.costCenterId) {
      centers = centers.filter((row) => row.costCenterId === params.costCenterId);
    } else if (params.query) {
      const q = params.query.trim();
      const matches = await prisma.costCenter.findMany({
        where: {
          companyId: context.companyId,
          isActive: true,
          OR: [
            { arabicName: { contains: q } },
            { code: { contains: q } },
            { englishName: { contains: q } },
          ],
        },
        select: { id: true },
        take: 20,
      });
      const ids = new Set(matches.map((row) => row.id));
      centers = centers.filter((row) => row.costCenterId && ids.has(row.costCenterId));
    }

    const rows = centers.slice(0, 20).map((row) => {
      const expenses = row.totalDebit;
      const revenues = row.totalCredit;
      const net = revenues - expenses;
      const marginPct = revenues > 0 ? Math.round((net / revenues) * 10000) / 100 : null;
      return {
        costCenterId: row.costCenterId,
        code: row.code,
        name: row.arabicName,
        revenues,
        expenses,
        netMargin: net,
        marginPercent: marginPct,
      };
    });

    return {
      period: 'this_year',
      projects: rows,
      totals: {
        revenues: rows.reduce((sum, row) => sum + row.revenues, 0),
        expenses: rows.reduce((sum, row) => sum + row.expenses, 0),
        netMargin: rows.reduce((sum, row) => sum + row.netMargin, 0),
      },
    };
  }
}
