import { z } from 'zod';
import { BaseAiTool } from './base-ai-tool';
import type { SecurityContext } from './types';
import type { ActiveInsight } from '../proactive/insight.store';

const paramsSchema = z.object({});

export type MorningBriefingPort = {
  listActive: (companyId: string) => Promise<ActiveInsight[]>;
};

export class GetMorningBriefingTool extends BaseAiTool<Record<string, never>> {
  readonly name = 'getMorningBriefing';
  readonly description =
    'Active CFO insights for today: cash-flow risk, overdue receivables, stock runout, project margin drop. Use when the user asks إيه الأخبار النهاردة، ملخص الوضع المالي، or morning briefing.';
  readonly parameters = paramsSchema;
  readonly requiredPermission = 'report:view';

  constructor(private readonly insights: MorningBriefingPort) {
    super();
  }

  protected async run(_params: Record<string, never>, context: SecurityContext) {
    const rows = await this.insights.listActive(context.companyId);
    const critical = rows.filter((row) => row.severity === 'CRITICAL').length;
    const warning = rows.filter((row) => row.severity === 'WARNING').length;
    return {
      asOf: new Date().toISOString().slice(0, 10),
      found: rows.length > 0,
      criticalCount: critical,
      warningCount: warning,
      insights: rows.map((row) => ({
        id: row.id,
        category: row.category,
        severity: row.severity,
        title: row.title,
        summary: row.summary,
        actionLink: row.actionLink,
        createdAt: row.createdAt,
      })),
      instruction:
        rows.length === 0
          ? 'No active CFO insights for this company today. Say the financial briefing is clear.'
          : 'Brief the user from these insights only. Do not invent extra alerts or numbers.',
    };
  }
}
