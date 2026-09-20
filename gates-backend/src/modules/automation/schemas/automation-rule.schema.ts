import { z } from 'zod';

/**
 * V1 condition operators. Evaluation lives in n8n — this schema only
 * validates stored definitions. eventType and action.type stay generic.
 */
export const AUTOMATION_CONDITION_OPERATORS = [
  'eq',
  'neq',
  'gt',
  'gte',
  'lt',
  'lte',
  'contains',
  'in',
] as const;

export type AutomationConditionOperator = (typeof AUTOMATION_CONDITION_OPERATORS)[number];

const SECRET_CONFIG_KEY =
  /^(secret|password|token|api[_-]?key|private[_-]?key|access[_-]?token|client[_-]?secret)$/i;

export const automationConditionSchema = z
  .object({
    field: z.string().trim().min(1, 'Condition field is required'),
    operator: z.enum(AUTOMATION_CONDITION_OPERATORS, {
      errorMap: () => ({ message: 'Unsupported condition operator' }),
    }),
    value: z.unknown(),
  })
  .superRefine((condition, ctx) => {
    if (condition.value === undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Condition value is required',
        path: ['value'],
      });
    }
    if (condition.operator === 'in' && !Array.isArray(condition.value)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Operator "in" requires an array value',
        path: ['value'],
      });
    }
  });

export const automationActionSchema = z
  .object({
    type: z.string().trim().min(1, 'Action type is required'),
    config: z.record(z.unknown()).optional(),
  })
  .superRefine((action, ctx) => {
    if (!action.config) return;
    for (const key of Object.keys(action.config)) {
      if (SECRET_CONFIG_KEY.test(key)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Action config must not store integration secrets',
          path: ['config', key],
        });
      }
    }
  });

export const createAutomationRuleSchema = z.object({
  name: z.string().trim().min(1, 'Name is required'),
  description: z.string().trim().max(4000).optional().nullable(),
  eventType: z.string().trim().min(1, 'eventType is required'),
  enabled: z.boolean().default(true),
  conditions: z.array(automationConditionSchema),
  actions: z.array(automationActionSchema).min(1, 'At least one action is required'),
});

export const updateAutomationRuleSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').optional(),
  description: z.string().trim().max(4000).optional().nullable(),
  eventType: z.string().trim().min(1, 'eventType is required').optional(),
  enabled: z.boolean().optional(),
  conditions: z.array(automationConditionSchema).optional(),
  actions: z.array(automationActionSchema).min(1, 'At least one action is required').optional(),
});

export const setAutomationRuleEnabledSchema = z.object({
  enabled: z.boolean(),
});

export const automationRuleQuerySchema = z.object({
  page: z
    .union([z.string(), z.number()])
    .optional()
    .transform((val) => {
      const n = typeof val === 'number' ? val : val ? parseInt(val, 10) : 1;
      return Number.isFinite(n) && n > 0 ? n : 1;
    }),
  limit: z
    .union([z.string(), z.number()])
    .optional()
    .transform((val) => {
      const n = typeof val === 'number' ? val : val ? parseInt(val, 10) : 50;
      return Number.isFinite(n) && n > 0 ? Math.min(n, 200) : 50;
    }),
  search: z.string().optional(),
  eventType: z.string().trim().min(1).optional(),
  enabled: z
    .union([z.boolean(), z.string()])
    .optional()
    .transform((val) =>
      val === undefined ? undefined : val === true || val === 'true'
    ),
});

export const automationRuleIdParamSchema = z.object({
  id: z.string().uuid('Rule id must be a UUID'),
});

/**
 * n8n lookup: companyId is supplied by the event pipeline (service-to-service),
 * not by a frontend session. Tenant isolation is enforced by API-key scope
 * (see authenticateInternalAutomation).
 */
export const internalAutomationRuleLookupQuerySchema = z.object({
  companyId: z.string().uuid('companyId must be a company UUID'),
  eventType: z.string().trim().min(1, 'eventType is required'),
});

export type CreateAutomationRuleInput = z.infer<typeof createAutomationRuleSchema>;
export type UpdateAutomationRuleInput = z.infer<typeof updateAutomationRuleSchema>;
export type AutomationRuleQueryInput = z.infer<typeof automationRuleQuerySchema>;
export type InternalAutomationRuleLookupQuery = z.infer<
  typeof internalAutomationRuleLookupQuerySchema
>;
export type AutomationConditionInput = z.infer<typeof automationConditionSchema>;
export type AutomationActionInput = z.infer<typeof automationActionSchema>;
