/**
 * Gates Automation — frontend types.
 * Mirror the shapes returned by /api/v1/automation/rules and /api/v1/automation/runs.
 * Do not add fields the backend does not actually return.
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

export type AutomationCondition = {
  field: string;
  operator: AutomationConditionOperator;
  value: unknown;
};

export type AutomationAction = {
  type: string;
  config?: Record<string, unknown>;
};

export type AutomationRule = {
  id: string;
  companyId: string;
  name: string;
  description: string | null;
  eventType: string;
  enabled: boolean;
  conditions: AutomationCondition[];
  actions: AutomationAction[];
  createdAt: string;
  updatedAt: string;
};

export type AutomationRuleListParams = {
  page?: number;
  limit?: number;
  search?: string;
  eventType?: string;
  enabled?: boolean;
};

export type CreateAutomationRuleInput = {
  name: string;
  description?: string | null;
  eventType: string;
  enabled?: boolean;
  conditions: AutomationCondition[];
  actions: AutomationAction[];
};

export type UpdateAutomationRuleInput = Partial<CreateAutomationRuleInput>;

export const AUTOMATION_RUN_STATUSES = ['PENDING', 'SUCCEEDED', 'FAILED'] as const;
export type AutomationRunStatus = (typeof AUTOMATION_RUN_STATUSES)[number];

export type AutomationRun = {
  id: string;
  companyId: string;
  eventId: string;
  eventType: string | null;
  ruleId: string;
  ruleName: string | null;
  actionType: string;
  correlationId: string;
  status: AutomationRunStatus;
  attemptCount: number;
  startedAt: string;
  completedAt: string | null;
  resultEntityType: string | null;
  resultEntityId: string | null;
  resultMetadata: Record<string, unknown> | null;
  lastErrorCode: string | null;
  errorMessage: string | null;
  createdAt: string;
  updatedAt: string;
};

export type AutomationRunListParams = {
  page?: number;
  limit?: number;
  eventId?: string;
  eventType?: string;
  ruleId?: string;
  status?: AutomationRunStatus;
};
