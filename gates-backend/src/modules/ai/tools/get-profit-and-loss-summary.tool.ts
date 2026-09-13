import { z } from 'zod';
import { OWNER_ROLES } from './ai-tool-access';
import { BaseAiTool } from './base-ai-tool';
import { isoDateSchema } from './shared-schemas';
import { defaultMonthRange } from './strip-tenant-args';
import type { SecurityContext } from './types';

const paramsSchema = z.object({
  startDate: isoDateSchema,
  endDate: isoDateSchema,
});

type Params = z.infer<typeof paramsSchema>;

export type ProfitAndLossPort = {
  getIncomeStatement: (params: {
    companyId: string;
    branchId?: string;
    fiscalYearId?: string;
    startDate: Date;
    endDate: Date;
  }) => Promise<{
    revenues?: number;
    costOfGoodsSold?: number;
    grossProfit?: number;
    operatingExpenses?: number;
    netProfit?: number;
    summary?: Record<string, number>;
  }>;
};

export class GetProfitAndLossSummaryTool extends BaseAiTool<Params> {
  readonly name = 'getProfitAndLossSummary';
  readonly description =
    'Period P&L: revenue, COGS, gross margin, operating expenses, net profit. Read-only.';
  readonly parameters = paramsSchema;
  readonly requiredPermission = 'report:view';
  readonly allowedRoles = OWNER_ROLES;

  constructor(private readonly reports: ProfitAndLossPort) {
    super();
  }

  protected async run(params: Params, context: SecurityContext) {
    const { fromDate: startDate, toDate: endDate } = defaultMonthRange(params.startDate, params.endDate);
    const statement = await this.reports.getIncomeStatement({
      companyId: context.companyId,
      branchId: context.branchId,
      fiscalYearId: context.fiscalYearId,
      startDate,
      endDate,
    });

    const revenue = Number(statement.summary?.totalRevenue ?? statement.revenues ?? 0);
    const cogs = Number(statement.summary?.costOfGoodsSold ?? statement.costOfGoodsSold ?? 0);
    const grossProfit = Number(statement.summary?.grossProfit ?? statement.grossProfit ?? 0);
    const expenses = Number(statement.summary?.totalExpenses ?? statement.operatingExpenses ?? 0);
    const netProfit = Number(statement.summary?.netProfit ?? statement.netProfit ?? 0);

    return {
      startDate: startDate.toISOString().slice(0, 10),
      endDate: endDate.toISOString().slice(0, 10),
      revenue,
      cogs,
      grossProfit,
      grossMarginPercent: revenue > 0 ? (grossProfit / revenue) * 100 : 0,
      expenses,
      netProfit,
    };
  }
}
