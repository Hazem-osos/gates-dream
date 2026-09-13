'use client';

import { useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api/client';
import { toast } from '@/lib/feedback/toast';
import { useOptimisticMutation } from '@/lib/hooks/useOptimisticMutation';
import type { ApiResponse } from '@/lib/api/types';
import { queryKeys } from '@/lib/query/query-keys';

export type CancelDraftInvoiceRow = {
  id: string;
  [key: string]: unknown;
};

export type UseCancelDraftInvoiceOptions = {
  /** Extra optimistic work (e.g. checkbox selection). Return a restore fn. */
  onOptimisticSideEffect?: (invoiceId: string) => (() => void) | void;
};

/**
 * Draft invoice cancel with snapshot rollback and unconditional list/badge
 * invalidation after settle. Posted invoices must not use this hook.
 */
export function useCancelDraftInvoice<T extends CancelDraftInvoiceRow = CancelDraftInvoiceRow>(
  options?: UseCancelDraftInvoiceOptions
) {
  const queryClient = useQueryClient();

  return useOptimisticMutation<T, string>(
    (id) => apiClient.post<T>(`/invoices/${id}/cancel`, {}),
    {
      cancelQueryKeys: [['invoices']],
      onOptimistic: ({ variables, queryClient: qc }) => {
        const snapshots = qc.getQueriesData<ApiResponse<T[]>>({
          queryKey: ['invoices'],
        });
        const restoreSideEffect = options?.onOptimisticSideEffect?.(variables);
        qc.setQueriesData<ApiResponse<T[]>>({ queryKey: ['invoices'] }, (old) => {
          if (!old?.data) return old;
          const nextTotal = Math.max(0, (old.pagination?.total ?? old.data.length) - 1);
          return {
            ...old,
            data: old.data.filter((row) => row.id !== variables),
            pagination: old.pagination
              ? { ...old.pagination, total: nextTotal }
              : old.pagination,
          };
        });
        return {
          rollback: () => {
            for (const [key, data] of snapshots) {
              qc.setQueryData(key, data);
            }
            if (typeof restoreSideEffect === 'function') {
              restoreSideEffect();
            }
          },
        };
      },
      onError: (error) => {
        toast.error('تعذر إلغاء المسودة', {
          description: error.message || 'تم استرجاع قائمة الفواتير.',
        });
      },
      onSettled: () => {
        void queryClient.invalidateQueries({ queryKey: ['invoices'] });
        void queryClient.invalidateQueries({ queryKey: ['invoice-badges'] });
        void queryClient.invalidateQueries({ queryKey: queryKeys.invoiceBadges });
      },
    }
  );
}
