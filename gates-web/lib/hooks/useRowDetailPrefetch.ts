'use client';

import { useCallback, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { prefetchApiQuery } from '@/lib/query/prefetch-api-query';
import { cachePolicies } from '@/lib/query/cache-policies';

const DEBOUNCE_MS = 50;

export type RowDetailPrefetchTarget = {
  key: readonly unknown[];
  url: string;
};

/**
 * Hover / keyboard-focus prefetch for a list row's detail endpoint.
 * Matches `useApiQuery` keys (`[...key, params]` with params undefined).
 */
export function useRowDetailPrefetch() {
  const queryClient = useQueryClient();
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const prefetchDetail = useCallback(
    (target: RowDetailPrefetchTarget | null | undefined) => {
      if (!target?.url || !target.key.length) return;
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        void prefetchApiQuery(queryClient, {
          key: target.key,
          url: target.url,
          staleTime: cachePolicies.transactional.staleTime,
          gcTime: cachePolicies.transactional.gcTime,
        });
      }, DEBOUNCE_MS);
    },
    [queryClient]
  );

  const getRowPrefetchHandlers = useCallback(
    (target: RowDetailPrefetchTarget | null | undefined) => ({
      onMouseEnter: () => prefetchDetail(target),
      onFocus: () => prefetchDetail(target),
    }),
    [prefetchDetail]
  );

  return { prefetchDetail, getRowPrefetchHandlers };
}

export function invoiceDetailPrefetch(id: string): RowDetailPrefetchTarget {
  return { key: ['invoice', id], url: `/invoices/${id}` };
}

export function journalEntryDetailPrefetch(id: string): RowDetailPrefetchTarget {
  return { key: ['journal-entry', id], url: `/accounting/journal-entries/${id}` };
}

export function purchaseOrderDetailPrefetch(id: string): RowDetailPrefetchTarget {
  return { key: ['purchase-order', id], url: `/inventory/purchase-orders/${id}` };
}
