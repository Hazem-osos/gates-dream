import { z } from 'zod';
import { BaseAiTool } from './base-ai-tool';
import type { SecurityContext } from './types';
import { growthEngineService } from '../../growth/services/growth-engine.service';
import { growthImpactService } from '../../growth/services/growth-impact.service';

const paramsSchema = z.object({
  includeImpact: z.boolean().optional().describe('Include realized/actioned impact totals'),
});

type Params = z.infer<typeof paramsSchema>;

export class GetGrowthSummaryTool extends BaseAiTool<Params> {
  readonly name = 'getGrowthSummary';
  readonly description =
    'Read-only Gates Growth Engine summary: potential value by category and top explainable opportunities from ERP records.';
  readonly parameters = paramsSchema;
  readonly requiredPermission = 'report:view';

  protected async run(params: Params, context: SecurityContext) {
    const overview = await growthEngineService.getOverview(context.companyId);
    const impact = params.includeImpact
      ? await growthImpactService.getImpact(context.companyId)
      : undefined;
    return {
      ok: true,
      data: {
        potentialValue: overview.potentialValue,
        breakdown: overview.breakdown,
        topOpportunities: overview.opportunities.slice(0, 8).map((o) => ({
          title: o.title,
          category: o.category,
          estimatedValue: o.estimatedValue,
          whyDetected: o.whyDetected,
          status: o.status,
        })),
        emptyReason: overview.emptyReason,
        impact,
      },
    };
  }
}
