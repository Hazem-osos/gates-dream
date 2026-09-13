'use client';

import { useQuery } from '@tanstack/react-query';
import { isSoftQueryFailure } from '@/lib/api/isAbortError';
import { fetchJsonQuery } from '@/lib/api/query-fetch';

/**
 * Resolves the backend root URL (strip `/api/v1`) for public `/health` checks.
 */
export function resolveBackendHealthUrl(): string {
  const fromEnv = typeof process !== 'undefined' ? process.env.NEXT_PUBLIC_API_URL?.trim() : '';
  if (fromEnv) {
    const base = fromEnv.replace(/\/api\/v1\/?$/, '');
    return `${base.replace(/\/$/, '')}/health`;
  }
  if (typeof window !== 'undefined') {
    return `${window.location.origin}/health`;
  }
  const internal = (process.env.BACKEND_INTERNAL_URL || 'http://127.0.0.1:3001').replace(/\/$/, '');
  return `${internal}/health`;
}

/**
 * Lightweight connectivity check (no JWT). Keeps React Query active on pages
 * that still use mock tables; pair with domain-specific `useApiQuery` as reports are wired.
 */
export function useBackendReachability() {
  return useQuery({
    queryKey: ['backend-health'],
    queryFn: async ({ signal }) =>
      fetchJsonQuery(async (sig) => {
        const url = resolveBackendHealthUrl();
        const res = await fetch(url, { method: 'GET', cache: 'no-store', signal: sig });
        if (!res.ok) {
          throw new Error(`Health check failed: ${res.status}`);
        }
        return res.json() as Promise<Record<string, unknown>>;
      }, signal),
    staleTime: 60_000,
    retry: (failureCount, error) => {
      if (isSoftQueryFailure(error)) return false;
      return failureCount < 1;
    },
    throwOnError: false,
    refetchOnWindowFocus: false,
  });
}
