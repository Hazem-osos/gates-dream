import { CancelledError } from '@tanstack/query-core';
import { apiClient } from '@/lib/api/client';
import { isSoftQueryFailure } from '@/lib/api/isAbortError';
import type { ApiResponse, QueryParams } from '@/lib/api/types';

/**
 * Wraps apiClient.get for React Query. Converts navigation/query aborts into a silent
 * CancelledError so TanStack Query + Next.js dev overlay do not treat them as crashes.
 */
export async function fetchApiQuery<T>(
  url: string,
  params: QueryParams | undefined,
  signal?: AbortSignal,
  config?: { timeout?: number }
): Promise<ApiResponse<T>> {
  if (signal?.aborted) {
    throw new CancelledError({ silent: true });
  }
  try {
    return await apiClient.get<T>(url, params, { signal, ...config });
  } catch (error) {
    if (isSoftQueryFailure(error)) {
      throw new CancelledError({ silent: true });
    }
    throw error;
  }
}

export async function fetchJsonQuery<T>(
  fetcher: (signal: AbortSignal) => Promise<T>,
  signal?: AbortSignal
): Promise<T> {
  if (signal?.aborted) {
    throw new CancelledError({ silent: true });
  }
  try {
    return await fetcher(signal);
  } catch (error) {
    if (isSoftQueryFailure(error)) {
      throw new CancelledError({ silent: true });
    }
    throw error;
  }
}
