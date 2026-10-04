/**
 * Read-only check for rules saved before the typed catalog.
 * Does not rewrite or delete the stored rule.
 */
import { AppError } from '../../../shared/middleware/error-handler';
import { validateAutomationActions, type AutomationActionLike } from './action-validator';
import { validateAutomationConditions, type AutomationConditionLike } from './condition-validator';

export type RuleAttention = {
  needsAttention: boolean;
  messages: string[];
};

function messageOf(error: unknown): string {
  if (error instanceof AppError || error instanceof Error) return error.message;
  return 'This automation does not match the current catalog';
}

export async function collectRuleIssues(
  companyId: string,
  eventType: string,
  conditions: unknown,
  actions: unknown
): Promise<string[]> {
  const issues: string[] = [];
  try {
    await validateAutomationConditions(
      companyId,
      eventType,
      (Array.isArray(conditions) ? conditions : []) as AutomationConditionLike[],
      { requireCreatable: false }
    );
  } catch (error) {
    issues.push(messageOf(error));
  }
  try {
    await validateAutomationActions(
      companyId,
      eventType,
      (Array.isArray(actions) ? actions : []) as AutomationActionLike[]
    );
  } catch (error) {
    issues.push(messageOf(error));
  }
  return issues;
}

export async function ruleAttention(
  companyId: string,
  eventType: string,
  conditions: unknown,
  actions: unknown
): Promise<RuleAttention> {
  const messages = await collectRuleIssues(companyId, eventType, conditions, actions);
  return { needsAttention: messages.length > 0, messages };
}
