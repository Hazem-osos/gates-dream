'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api/client';
import { clearConditionalGetCache } from '@/lib/api/conditional-get-cache';
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
  creditLimit?: number | null;
  currencyCode?: string | null;
  accountKind?: 'HEADER' | 'POSTING';
  accountNature?: 'DEBIT' | 'CREDIT';
  statementType?: 'BALANCE_SHEET' | 'INCOME_STATEMENT';
  requiresCostCenter?: boolean;
};

export function useCoaTreeQuery() {
  return useApiQuery<CoaHierarchyAccount[]>(
    ['coa-tree'],
    '/accounting/accounts/tree',
    undefined,
    { staleTime: 0, refetchOnMount: 'always', requireFullTenant: false }
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
    clearConditionalGetCache();
    void invalidate(['coa-tree']);
    void invalidate(['accounts']);
    void invalidate(['coa-suggest-code']);
    void invalidate(['safes']);
    void invalidate(['bank-accounts']);
    void invalidate(['journal-entries']);
    void invalidate(['journal-entry']);
  };
}

function mergeCreatedAccountIntoPickerCache(
  queryClient: ReturnType<typeof useQueryClient>,
  account: { id?: string; code?: string | null; arabicName?: string | null; accountKind?: string | null }
) {
  if (!account.id) return;
  const row = {
    id: account.id,
    code: account.code ?? '',
    arabicName: account.arabicName ?? '',
    accountKind: account.accountKind ?? 'POSTING',
    _count: { children: 0 },
  };
  queryClient.setQueriesData({ queryKey: ['accounts'] }, (old) => {
    if (!old || typeof old !== 'object' || !('data' in old) || !Array.isArray(old.data)) return old;
    if (old.data.some((item) => item && typeof item === 'object' && 'id' in item && item.id === row.id)) {
      return old;
    }
    return { ...old, data: [row, ...old.data] };
  });
}

export function useCreateAccountMutation() {
  const refresh = useCoaRefresh();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: AccountFormPayload) => apiClient.post('/accounting/accounts', body),
    onSuccess: (res) => {
      const account = res?.data;
      if (account && typeof account === 'object') {
        mergeCreatedAccountIntoPickerCache(queryClient, account as {
          id?: string;
          code?: string | null;
          arabicName?: string | null;
          accountKind?: string | null;
        });
      }
      refresh();
    },
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
