import prisma from '../../../shared/database/prisma';
import { runWithoutTenantScoping } from '../../../shared/database/tenant-context';
import { AutomationActionRunService } from './automation-action-run.service';

export const automationActionRunService = new AutomationActionRunService(prisma);

export async function loadRuleNames(
  companyId: string,
  ruleIds: string[]
): Promise<Map<string, string>> {
  const unique = [...new Set(ruleIds.filter(Boolean))];
  if (unique.length === 0) return new Map();
  const rules = await runWithoutTenantScoping(() =>
    prisma.automationRule.findMany({
      where: { companyId, id: { in: unique } },
      select: { id: true, name: true },
    })
  );
  return new Map(rules.map((rule) => [rule.id, rule.name]));
}
