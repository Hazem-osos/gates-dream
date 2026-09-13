import { z } from 'zod';
import { BaseAiTool } from './base-ai-tool';
import type { SecurityContext } from './types';

const paramsSchema = z.object({});

export type ProjectProfitabilityPort = {
  getSummary: (companyId: string) => Promise<{
    asOfDate: string;
    kpis: {
      activeProjects: number;
      activeContractValue: number;
      portfolioSpi: number | null;
      earnedValue: number;
      actualCost: number;
      lgFrozenMargin: number;
      costVariance: number;
      portfolioCpi: number | null;
      budgetAtCompletion: number;
    };
    charts?: { costDistribution?: unknown[] };
  }>;
};

export class GetProjectProfitabilityTool extends BaseAiTool<Record<string, never>> {
  readonly name = 'getProjectProfitability';
  readonly description =
    'Contracting portfolio: BOQ/SPI progress, actual cost, retention/LG margin, EV/AC/CV. Read-only.';
  readonly parameters = paramsSchema;
  readonly requiredPermission = 'project:view';

  constructor(private readonly dashboard: ProjectProfitabilityPort) {
    super();
  }

  protected async run(_params: Record<string, never>, context: SecurityContext) {
    const summary = await this.dashboard.getSummary(context.companyId);
    const kpis = summary.kpis;

    return {
      asOfDate: summary.asOfDate,
      activeProjects: kpis.activeProjects,
      contractValue: kpis.activeContractValue,
      boqProgressSpi: kpis.portfolioSpi,
      earnedValue: kpis.earnedValue,
      expensesActualCost: kpis.actualCost,
      retentionAndLgMargin: kpis.lgFrozenMargin,
      netProfitCostVariance: kpis.costVariance,
      portfolioCpi: kpis.portfolioCpi,
      budgetAtCompletion: kpis.budgetAtCompletion,
      costDistribution: summary.charts?.costDistribution ?? [],
    };
  }
}
