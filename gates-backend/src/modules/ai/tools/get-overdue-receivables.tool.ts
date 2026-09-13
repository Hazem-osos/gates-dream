import { z } from 'zod';
import { BaseAiTool } from './base-ai-tool';
import { isoDateSchema, optionalUuid } from './shared-schemas';
import { parseIsoDate } from './strip-tenant-args';
import type { SecurityContext } from './types';

const paramsSchema = z.object({
  asOfDate: isoDateSchema.describe('Aging as-of date (YYYY-MM-DD)'),
  customerId: optionalUuid,
});

type Params = z.infer<typeof paramsSchema>;

export type OverdueReceivablesPort = {
  getAgedReceivables: (params: {
    companyId: string;
    branchId?: string;
    asOfDate: Date;
    customerId?: string;
  }) => Promise<{
    grandTotal: number;
    bucketTotals: Record<string, number>;
    bucketLabels: Record<string, string>;
    parties?: Array<{
      partyId: string;
      partyName: string;
      total: number;
      buckets: Record<string, number>;
    }>;
    controlAccountTieOut?: unknown;
  }>;
};

export class GetOverdueReceivablesTool extends BaseAiTool<Params> {
  readonly name = 'getOverdueReceivables';
  readonly description = 'Customer AR aging buckets and overdue balances. Read-only.';
  readonly parameters = paramsSchema;
  readonly requiredPermission = 'report:view';

  constructor(private readonly aging: OverdueReceivablesPort) {
    super();
  }

  protected async run(params: Params, context: SecurityContext) {
    const asOfDate = parseIsoDate(params.asOfDate);
    const report = await this.aging.getAgedReceivables({
      companyId: context.companyId,
      branchId: context.branchId,
      asOfDate,
      customerId: params.customerId,
    });

    return {
      asOfDate: asOfDate.toISOString().slice(0, 10),
      grandTotal: report.grandTotal,
      bucketTotals: report.bucketTotals,
      bucketLabels: report.bucketLabels,
      parties: (report.parties ?? []).slice(0, 25).map((party) => ({
        customerId: party.partyId,
        customerName: party.partyName,
        total: party.total,
        buckets: party.buckets,
      })),
      controlAccountTieOut: report.controlAccountTieOut,
    };
  }
}
