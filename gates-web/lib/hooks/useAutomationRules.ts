'use client';

import { useApiMutation, useApiQuery, useInvalidateQuery } from './useApi';
import { queryKeys, staleTimes } from '../query/query-keys';
import type {
  AutomationRule,
  AutomationRuleListParams,
  CreateAutomationRuleInput,
  UpdateAutomationRuleInput,
} from '../automation/types';

export function useAutomationRulesQuery(params?: AutomationRuleListParams) {
  return useApiQuery<AutomationRule[]>(
    queryKeys.automation.rules(params as Record<string, unknown>),
    '/automation/rules',
    params as Record<string, unknown>,
    { staleTime: staleTimes.transactionalMs }
  );
}

export function useAutomationRuleQuery(id: string | null | undefined) {
  return useApiQuery<AutomationRule>(
    queryKeys.automation.rule(id ?? ''),
    `/automation/rules/${id}`,
    undefined,
    { enabled: Boolean(id), staleTime: staleTimes.transactionalMs }
  );
}

export function useCreateAutomationRule() {
  const invalidate = useInvalidateQuery();
  return useApiMutation<AutomationRule, CreateAutomationRuleInput>('/automation/rules', 'POST', {
    successMessage: 'تم إنشاء الأتمتة',
    onSuccess: () => invalidate(queryKeys.automation.all),
  });
}

export function useUpdateAutomationRule(id: string) {
  const invalidate = useInvalidateQuery();
  return useApiMutation<AutomationRule, UpdateAutomationRuleInput>(`/automation/rules/${id}`, 'PUT', {
    successMessage: 'تم حفظ التعديلات',
    onSuccess: () => invalidate(queryKeys.automation.all),
  });
}

export function useSetAutomationRuleEnabled(id: string) {
  const invalidate = useInvalidateQuery();
  return useApiMutation<AutomationRule, { enabled: boolean }>(`/automation/rules/${id}/enabled`, 'PATCH', {
    showSuccessToast: false,
    onSuccess: () => invalidate(queryKeys.automation.all),
  });
}

export function useDeleteAutomationRule(id: string) {
  const invalidate = useInvalidateQuery();
  return useApiMutation<unknown, void>(`/automation/rules/${id}`, 'DELETE', {
    successMessage: 'تم حذف الأتمتة',
    onSuccess: () => invalidate(queryKeys.automation.all),
  });
}
