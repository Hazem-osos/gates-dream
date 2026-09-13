import { z } from 'zod';
import { BaseAiTool } from './base-ai-tool';
import { isoDateSchema, optionalUuid } from './shared-schemas';
import { defaultMonthRange } from './strip-tenant-args';
import type { SecurityContext } from './types';

const paramsSchema = z.object({
  fromDate: isoDateSchema.describe('Inclusive start date (YYYY-MM-DD)'),
  toDate: isoDateSchema.describe('Inclusive end date (YYYY-MM-DD)'),
  warehouseId: optionalUuid,
  customerId: optionalUuid,
  unpaidOnly: z.boolean().optional(),
});

type Params = z.infer<typeof paramsSchema>;

export type SalesReportPort = {
  getSalesReport: (
    filters: {
      companyId: string;
      branchId?: string;
      fromDate: Date;
      toDate: Date;
      warehouseId?: string;
      customerId?: string;
      unpaidOnly?: boolean;
    },
    options?: { limit?: number; includeSummary?: boolean }
  ) => Promise<{ data?: Array<{ taxAmount?: unknown }>; summary?: Record<string, unknown> }>;
};

export class GetSalesSummaryTool extends BaseAiTool<Params> {
  readonly name = 'getSalesSummary';
  readonly description =
    'Posted sales for a date range: invoice count, total sales, and tax total. Read-only.';
  readonly parameters = paramsSchema;
  readonly requiredPermission = 'report:view';

  constructor(private readonly reports: SalesReportPort) {
    super();
  }

  protected async run(params: Params, context: SecurityContext) {
    const { fromDate, toDate } = defaultMonthRange(params.fromDate, params.toDate);
    const report = await this.reports.getSalesReport(
      {
        companyId: context.companyId,
        branchId: context.branchId,
        fromDate,
        toDate,
        warehouseId: params.warehouseId,
        customerId: params.customerId,
        unpaidOnly: params.unpaidOnly,
      },
      { limit: 100, includeSummary: true }
    );

    const rows = Array.isArray(report.data) ? report.data : [];
    const taxTotal = rows.reduce((sum, invoice) => sum + Number(invoice.taxAmount ?? 0), 0);

    return {
      fromDate: fromDate.toISOString().slice(0, 10),
      toDate: toDate.toISOString().slice(0, 10),
      invoiceCount: Number(report.summary?.totalInvoices ?? rows.length ?? 0),
      totalSales: Number(report.summary?.totalSales ?? 0),
      taxTotal,
      totalQuantity: Number(report.summary?.totalQuantity ?? 0),
    };
  }
}
