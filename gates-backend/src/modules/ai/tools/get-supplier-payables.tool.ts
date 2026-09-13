import { z } from 'zod';
import { BaseAiTool } from './base-ai-tool';
import { isoDateSchema, optionalUuid } from './shared-schemas';
import { parseIsoDate } from './strip-tenant-args';
import type { SecurityContext } from './types';

const paramsSchema = z.object({
  asOfDate: isoDateSchema,
  supplierId: optionalUuid,
});

type Params = z.infer<typeof paramsSchema>;

export type SupplierPayablesPort = {
  getAgedPayables: (params: {
    companyId: string;
    branchId?: string;
    asOfDate: Date;
    supplierId?: string;
  }) => Promise<{
    grandTotal: number;
    bucketTotals: Record<string, number>;
    parties?: Array<{
      partyId: string;
      partyName: string;
      total: number;
      buckets: Record<string, number>;
    }>;
  }>;
};

export class GetSupplierPayablesTool extends BaseAiTool<Params> {
  readonly name = 'getSupplierPayables';
  readonly description = 'Outstanding AP aging balances owed to suppliers. Read-only.';
  readonly parameters = paramsSchema;
  readonly requiredPermission = 'report:view';

  constructor(private readonly aging: SupplierPayablesPort) {
    super();
  }

  protected async run(params: Params, context: SecurityContext) {
    const asOfDate = parseIsoDate(params.asOfDate);
    const report = await this.aging.getAgedPayables({
      companyId: context.companyId,
      branchId: context.branchId,
      asOfDate,
      supplierId: params.supplierId,
    });

    return {
      asOfDate: asOfDate.toISOString().slice(0, 10),
      grandTotal: report.grandTotal,
      bucketTotals: report.bucketTotals,
      suppliers: (report.parties ?? []).slice(0, 25).map((party) => ({
        supplierId: party.partyId,
        supplierName: party.partyName,
        total: party.total,
        buckets: party.buckets,
      })),
    };
  }
}
