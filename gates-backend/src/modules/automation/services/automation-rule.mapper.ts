import { runWithoutTenantScoping } from '../../../shared/database/tenant-context';
import type {
  AutomationRuleDb,
  AutomationRuleN8nView,
  AutomationRuleRecord,
} from './automation-rule.types';

/**
 * Stable position in the saved actions array. This is not a retry counter.
 * n8n's universal One Action step must copy this field onto
 * POST /internal/v1/automation/actions/execute as `actionIndex`.
 */
export function stampActionIndexes(actions: unknown): unknown {
  if (!Array.isArray(actions)) return actions;
  return actions.map((action, actionIndex) => {
    if (!action || typeof action !== 'object' || Array.isArray(action)) {
      return { actionIndex };
    }
    return { ...(action as Record<string, unknown>), actionIndex };
  });
}

export function toN8nAutomationRule(rule: AutomationRuleRecord): AutomationRuleN8nView {
  return {
    id: rule.id,
    companyId: rule.companyId,
    name: rule.name,
    description: rule.description,
    enabled: rule.enabled,
    eventType: rule.eventType,
    conditions: rule.conditions,
    actions: stampActionIndexes(rule.actions),
  };
}

export function buildEnabledLookupWhere(companyId: string, eventType: string) {
  return {
    companyId,
    eventType,
    enabled: true,
  };
}

/**
 * Platform/n8n callers may run outside a JWT tenant ALS context (or inside
 * the wrong one). Always filter by the requested companyId after bypassing
 * request-scoped tenant AND — isolation is the explicit where clause.
 */
export async function listEnabledRulesForEvent(
  companyId: string,
  eventType: string,
  db: AutomationRuleDb
): Promise<AutomationRuleN8nView[]> {
  const where = buildEnabledLookupWhere(companyId, eventType);
  const rows = await runWithoutTenantScoping(() =>
    db.automationRule.findMany({
      where,
      orderBy: { createdAt: 'asc' },
    })
  );
  return rows.map(toN8nAutomationRule);
}
