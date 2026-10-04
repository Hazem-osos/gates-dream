'use client';

import { useI18n } from '@/lib/i18n';
import { useApiMutation, useApiQuery, useInvalidateQuery } from './useApi';
import { queryKeys, staleTimes } from '../query/query-keys';
import type { AutomationMetadata, AutomationTemplateDef } from '../automation/metadata';
import type {
  AutomationRule,
  AutomationRuleListParams,
  CreateAutomationRuleInput,
  UpdateAutomationRuleInput,
} from '../automation/types';

export function useAutomationMetadataQuery() {
  return useApiQuery<AutomationMetadata>(queryKeys.automation.metadata(), '/automation/metadata', undefined, {
    staleTime: staleTimes.metadataMs,
  });
}

export function useAutomationTemplatesQuery() {
  return useApiQuery<AutomationTemplateDef[]>(
    queryKeys.automation.templates(),
    '/automation/templates',
    undefined,
    { staleTime: staleTimes.metadataMs }
  );
}

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
  const { t } = useI18n();
  return useApiMutation<AutomationRule, CreateAutomationRuleInput>('/automation/rules', 'POST', {
    successMessage: t('automation.created'),
    onSuccess: () => invalidate(queryKeys.automation.all),
  });
}

export function useUpdateAutomationRule(id: string) {
  const invalidate = useInvalidateQuery();
  const { t } = useI18n();
  return useApiMutation<AutomationRule, UpdateAutomationRuleInput>(`/automation/rules/${id}`, 'PUT', {
    successMessage: t('automation.saved'),
    onSuccess: () => invalidate(queryKeys.automation.all),
  });
}

export function useDuplicateAutomationRule(id: string) {
  const invalidate = useInvalidateQuery();
  const { t } = useI18n();
  return useApiMutation<AutomationRule, Record<string, unknown>>(`/automation/rules/${id}/duplicate`, 'POST', {
    successMessage: t('automation.duplicated'),
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
  const { t } = useI18n();
  return useApiMutation<unknown, void>(`/automation/rules/${id}`, 'DELETE', {
    successMessage: t('automation.deleted'),
    onSuccess: () => invalidate(queryKeys.automation.all),
  });
}
