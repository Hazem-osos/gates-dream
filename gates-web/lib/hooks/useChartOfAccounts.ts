'use client';

import { useMutation } from '@tanstack/react-query';
import { apiClient } from '@/lib/api/client';
import { useApiQuery, useInvalidateQuery } from './useApi';
import type { ApiError } from '@/lib/api/types';
import type { CoaHierarchyAccount } from '@/lib/accounting/mapCoaToTreeNodes';

export type AccountFormPayload = {
  code?: string;
  arabicName: string;
  englishName?: string;
  accountType?: string;
  parentId?: string | null;
  accountSide?: 'مدين' | 'دائن' | null;
  costCenterRequired?: 'إجباري' | 'اختياري' | 'بدون' | null;
  defaultCostCenterId?: string | null;
  warning?: 'مدين' | 'دائن' | 'بدون' | null;
  budget?: number | null;
  currencyCode?: string | null;
};

export function useCoaTreeQuery() {
  return useApiQuery<CoaHierarchyAccount[]>(
    ['coa-tree'],
    '/accounting/accounts/tree',
    undefined,
    { staleTime: 60_000, requireFullTenant: false }
  );
}

export function useSuggestAccountCode(parentId: string | null | undefined, enabled: boolean) {
  const params = parentId ? { parentId } : undefined;
  return useApiQuery<{ code: string; parentId: string | null }>(
    ['coa-suggest-code', parentId ?? 'root'],
    '/accounting/accounts/next-code',
    params,
    { enabled, staleTime: 0 }
  );
}

function useCoaRefresh() {
  const invalidate = useInvalidateQuery();
  return () => {
    void invalidate(['coa-tree']);
    void invalidate(['accounts']);
    void invalidate(['coa-suggest-code']);
  };
}

export function useCreateAccountMutation() {
  const refresh = useCoaRefresh();
  return useMutation({
    mutationFn: (body: AccountFormPayload) => apiClient.post('/accounting/accounts', body),
    onSuccess: refresh,
  });
}

export function useUpdateAccountMutation() {
  const refresh = useCoaRefresh();
  return useMutation({
    mutationFn: ({ id, ...body }: AccountFormPayload & { id: string }) =>
      apiClient.put(`/accounting/accounts/${id}`, body),
    onSuccess: refresh,
  });
}

export function useDeleteAccountMutation() {
  const refresh = useCoaRefresh();
  return useMutation<unknown, ApiError, { id: string }>({
    mutationFn: ({ id }) => apiClient.delete(`/accounting/accounts/${id}`),
    onSuccess: refresh,
  });
}
