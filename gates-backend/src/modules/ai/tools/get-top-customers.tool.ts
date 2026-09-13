import { z } from 'zod';
import { BaseAiTool } from './base-ai-tool';
import { defaultMonthRange } from './strip-tenant-args';
import type { SecurityContext } from './types';

const paramsSchema = z.object({
  months: z.number().int().min(1).max(24).optional().describe('Lookback months for revenue ranking'),
  limit: z.number().int().min(1).max(20).optional(),
  sortBy: z.enum(['revenue', 'overdue']).optional(),
});

type Params = z.infer<typeof paramsSchema>;

export type TopCustomersKpiPort = {
  getExecutiveKpis: (params: {
    companyId: string;
    branchId?: string;
    months?: number;
  }) => Promise<{ topCustomers?: Array<Record<string, unknown>> }>;
};
export type TopCustomersAgingPort = {
  getAgedReceivables: (params: {
    companyId: string;
    branchId?: string;
    asOfDate: Date;
  }) => Promise<{
    parties?: Array<{
      partyId: string;
      partyName: string;
      total: number;
      buckets: Record<string, number>;
    }>;
  }>;
};

export class GetTopCustomersTool extends BaseAiTool<Params> {
  readonly name = 'getTopCustomers';
  readonly description =
    'Top customers by revenue (executive KPIs) or overdue aging balance. Read-only.';
  readonly parameters = paramsSchema;
  readonly requiredPermission = 'report:view';

  constructor(
    private readonly analytics: TopCustomersKpiPort,
    private readonly aging: TopCustomersAgingPort
  ) {
    super();
  }

  protected async run(params: Params, context: SecurityContext) {
    const limit = params.limit ?? 5;
    const sortBy = params.sortBy ?? 'revenue';

    if (sortBy === 'overdue') {
      const { toDate } = defaultMonthRange();
      const report = await this.aging.getAgedReceivables({
        companyId: context.companyId,
        branchId: context.branchId,
        asOfDate: toDate,
      });
      return {
        sortBy,
        customers: (report.parties ?? []).slice(0, limit).map((party) => ({
          customerId: party.partyId,
          customerName: party.partyName,
          overdueBalance: party.total,
          buckets: party.buckets,
        })),
      };
    }

    const kpis = await this.analytics.getExecutiveKpis({
      companyId: context.companyId,
      branchId: context.branchId,
      months: params.months ?? 6,
    });
    return {
      sortBy,
      months: params.months ?? 6,
      customers: (kpis.topCustomers ?? []).slice(0, limit),
    };
  }
}
