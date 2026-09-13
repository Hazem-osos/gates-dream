'use client';

import { useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import { prefetchQueriesForHref } from '@/lib/navigation/route-prefetch-registry';
import { prefetchApiQueries } from '@/lib/query/prefetch-api-query';

const DEBOUNCE_MS = 60;

/**
 * Debounced Next.js route + TanStack Query prefetch on hover/focus intent.
 */
export function useInstantPrefetch() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const schedulePrefetch = useCallback(
    (href: string) => {
      const target = href.split('#')[0]?.trim();
      if (!target || !target.startsWith('/')) return;

      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        try {
          router.prefetch(target);
        } catch {
          /* prefetch optional in dev */
        }

        const defs = prefetchQueriesForHref(target);
        if (defs.length) {
          void prefetchApiQueries(queryClient, defs);
        }
      }, DEBOUNCE_MS);
    },
    [queryClient, router]
  );

  const getPrefetchHandlers = useCallback(
    (href: string) => ({
      onMouseEnter: () => schedulePrefetch(href),
      onFocus: () => schedulePrefetch(href),
    }),
    [schedulePrefetch]
  );

  return { schedulePrefetch, getPrefetchHandlers };
}
