import { AppError } from '../../../shared/middleware/error-handler';
import { logger } from '../../../shared/logger';
import type {
  CreateAutomationRuleInput,
  UpdateAutomationRuleInput,
} from '../schemas/automation-rule.schema';
import { listEnabledRulesForEvent } from './automation-rule.mapper';
import type { AutomationRuleDb } from './automation-rule.types';
import { validateAutomationConditions } from '../catalog/condition-validator';
import { validateAutomationActions } from '../catalog/action-validator';

/**
 * Validates a rule's (eventType, conditions, actions) against the
 * Automation Capability Catalog before it is persisted. Never rely on the
 * generic Zod shape schema alone — this checks that fields/operators/action
 * config actually exist and are well-typed for the target event.
 */
async function assertRuleAgainstCatalog(
  companyId: string,
  eventType: string,
  conditions: Array<{ field: string; operator: string; value?: unknown }>,
  actions: Array<{ type: string; config?: Record<string, unknown> }>
): Promise<void> {
  await validateAutomationConditions(companyId, eventType, conditions);
  await validateAutomationActions(companyId, eventType, actions);
}

export type {
  AutomationRuleDb,
  AutomationRuleN8nView,
  AutomationRuleRecord,
} from './automation-rule.types';
export { buildEnabledLookupWhere, listEnabledRulesForEvent, toN8nAutomationRule } from './automation-rule.mapper';

export class AutomationRuleService {
  constructor(private readonly db: AutomationRuleDb) {}

  async listRules(
    companyId: string,
    options: {
      page?: number;
      limit?: number;
      search?: string;
      eventType?: string;
      enabled?: boolean;
    } = {}
  ) {
    const page = options.page && options.page > 0 ? options.page : 1;
    const limit = options.limit && options.limit > 0 ? Math.min(options.limit, 200) : 50;
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = { companyId };
    if (options.eventType) where.eventType = options.eventType;
    if (options.enabled !== undefined) where.enabled = options.enabled;
    if (options.search?.trim()) {
      const search = options.search.trim();
      where.OR = [
        { name: { contains: search } },
        { description: { contains: search } },
        { eventType: { contains: search } },
      ];
    }

    const [rules, total] = await Promise.all([
      this.db.automationRule.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.db.automationRule.count({ where }),
    ]);

    return {
      rules,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async getRuleById(companyId: string, ruleId: string) {
    const rule = await this.db.automationRule.findFirst({
      where: { id: ruleId, companyId },
    });
    if (!rule) {
      throw new AppError(404, 'Automation rule not found');
    }
    return rule;
  }

  async createRule(companyId: string, data: CreateAutomationRuleInput) {
    await assertRuleAgainstCatalog(companyId, data.eventType, data.conditions, data.actions);

    const rule = await this.db.automationRule.create({
      data: {
        companyId,
        name: data.name,
        description: data.description ?? null,
        eventType: data.eventType,
        enabled: data.enabled ?? true,
        conditions: data.conditions,
        actions: data.actions,
      },
    });
    logger.info({ companyId, ruleId: rule.id, eventType: rule.eventType }, 'Automation rule created');
    return rule;
  }

  async updateRule(companyId: string, ruleId: string, data: UpdateAutomationRuleInput) {
    const existing = await this.getRuleById(companyId, ruleId);

    // Re-validate the FINAL merged (eventType, conditions, actions) so a
    // partial update can never leave a rule in a state that mixes an old
    // eventType with conditions/actions that don't belong to it.
    const nextEventType = data.eventType ?? existing.eventType;
    const nextConditions =
      data.conditions ??
      (existing.conditions as Array<{ field: string; operator: string; value?: unknown }>);
    const nextActions =
      data.actions ?? (existing.actions as Array<{ type: string; config?: Record<string, unknown> }>);
    await assertRuleAgainstCatalog(companyId, nextEventType, nextConditions, nextActions);

    const rule = await this.db.automationRule.update({
      where: { id: ruleId },
      data: {
        ...(data.name !== undefined ? { name: data.name } : {}),
        ...(data.description !== undefined ? { description: data.description } : {}),
        ...(data.eventType !== undefined ? { eventType: data.eventType } : {}),
        ...(data.enabled !== undefined ? { enabled: data.enabled } : {}),
        ...(data.conditions !== undefined ? { conditions: data.conditions } : {}),
        ...(data.actions !== undefined ? { actions: data.actions } : {}),
      },
    });
    logger.info({ companyId, ruleId: rule.id }, 'Automation rule updated');
    return rule;
  }

  async setEnabled(companyId: string, ruleId: string, enabled: boolean) {
    return this.updateRule(companyId, ruleId, { enabled });
  }

  /** Creates a disabled copy of an existing rule (never auto-enabled — avoids surprise double-firing). */
  async duplicateRule(companyId: string, ruleId: string) {
    const existing = await this.getRuleById(companyId, ruleId);
    const rule = await this.db.automationRule.create({
      data: {
        companyId,
        name: `${existing.name} (copy)`,
        description: existing.description,
        eventType: existing.eventType,
        enabled: false,
        conditions: existing.conditions as object,
        actions: existing.actions as object,
      },
    });
    logger.info(
      { companyId, sourceRuleId: ruleId, ruleId: rule.id },
      'Automation rule duplicated'
    );
    return rule;
  }

  async deleteRule(companyId: string, ruleId: string) {
    await this.getRuleById(companyId, ruleId);
    await this.db.automationRule.delete({ where: { id: ruleId } });
    logger.info({ companyId, ruleId }, 'Automation rule deleted');
  }

  async listEnabledForEvent(companyId: string, eventType: string) {
    return listEnabledRulesForEvent(companyId, eventType, this.db);
  }
}
