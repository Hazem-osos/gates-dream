import { z } from 'zod';
import { BaseAiTool } from './base-ai-tool';
import { isoDateSchema } from './shared-schemas';
import { defaultMonthRange } from './strip-tenant-args';
import type { SecurityContext } from './types';

const paramsSchema = z.object({
  startDate: isoDateSchema,
  endDate: isoDateSchema,
  limit: z.number().int().min(1).max(20).optional(),
});

type Params = z.infer<typeof paramsSchema>;

export type TopSellingItemsPort = {
  getInvoicesProfitReport: (
    filters: { companyId: string; branchId?: string; fromDate: Date; toDate: Date },
    options?: { limit?: number }
  ) => Promise<{ data?: Array<Record<string, any>> }>;
};

type ItemAgg = {
  itemId: string;
  itemName: string;
  quantity: number;
  revenue: number;
  cost: number;
  profit: number;
};

export class GetTopSellingItemsTool extends BaseAiTool<Params> {
  readonly name = 'getTopSellingItems';
  readonly description =
    'Highest-moving sales items by quantity and profit margin from the invoices profit report. Read-only.';
  readonly parameters = paramsSchema;
  readonly requiredPermission = 'report:view';

  constructor(private readonly reports: TopSellingItemsPort) {
    super();
  }

  protected async run(params: Params, context: SecurityContext) {
    const { fromDate, toDate } = defaultMonthRange(params.startDate, params.endDate);
    const report = await this.reports.getInvoicesProfitReport(
      {
        companyId: context.companyId,
        branchId: context.branchId,
        fromDate,
        toDate,
      },
      { limit: 200 }
    );

    const byItem = new Map<string, ItemAgg>();
    for (const row of Array.isArray(report.data) ? report.data : []) {
      const lines = row?.invoice?.lines ?? [];
      for (const line of lines) {
        const itemId = String(line.itemId ?? line.item?.id ?? '');
        if (!itemId) continue;
        const quantity = Number(line.quantity ?? 0);
        const revenue = Number(line.total ?? line.lineTotal ?? 0);
        const unitCost = Number(line.item?.beginningCostPrice ?? line.unitCost ?? 0);
        const cost = quantity * unitCost;
        const current = byItem.get(itemId) ?? {
          itemId,
          itemName: String(line.item?.arabicName ?? itemId),
          quantity: 0,
          revenue: 0,
          cost: 0,
          profit: 0,
        };
        current.quantity += quantity;
        current.revenue += revenue;
        current.cost += cost;
        current.profit = current.revenue - current.cost;
        byItem.set(itemId, current);
      }
    }

    const items = [...byItem.values()]
      .map((item) => ({
        ...item,
        profitMarginPercent: item.revenue > 0 ? (item.profit / item.revenue) * 100 : 0,
      }))
      .sort((a, b) => b.quantity - a.quantity)
      .slice(0, params.limit ?? 10);

    return {
      startDate: fromDate.toISOString().slice(0, 10),
      endDate: toDate.toISOString().slice(0, 10),
      items,
    };
  }
}
