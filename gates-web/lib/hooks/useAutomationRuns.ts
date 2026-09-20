'use client';

import { useApiQuery } from './useApi';
import { queryKeys, staleTimes } from '../query/query-keys';
import type { AutomationRun, AutomationRunListParams } from '../automation/types';

export function useAutomationRunsQuery(params?: AutomationRunListParams, options?: { enabled?: boolean }) {
  return useApiQuery<AutomationRun[]>(
    queryKeys.automation.runs(params as Record<string, unknown>),
    '/automation/runs',
    params as Record<string, unknown>,
    { staleTime: staleTimes.transactionalMs, enabled: options?.enabled }
  );
}

export function useAutomationRunQuery(id: string | null | undefined) {
  return useApiQuery<AutomationRun>(
    queryKeys.automation.run(id ?? ''),
    `/automation/runs/${id}`,
    undefined,
    { enabled: Boolean(id), staleTime: staleTimes.transactionalMs }
  );
}
