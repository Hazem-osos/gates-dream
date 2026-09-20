import { AppError } from '../../../shared/middleware/error-handler';
import { logger } from '../../../shared/logger';
import type {
  CreateAutomationRuleInput,
  UpdateAutomationRuleInput,
} from '../schemas/automation-rule.schema';
import { listEnabledRulesForEvent } from './automation-rule.mapper';
import type { AutomationRuleDb } from './automation-rule.types';

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
    await this.getRuleById(companyId, ruleId);

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

  async deleteRule(companyId: string, ruleId: string) {
    await this.getRuleById(companyId, ruleId);
    await this.db.automationRule.delete({ where: { id: ruleId } });
    logger.info({ companyId, ruleId }, 'Automation rule deleted');
  }

  async listEnabledForEvent(companyId: string, eventType: string) {
    return listEnabledRulesForEvent(companyId, eventType, this.db);
  }
}
