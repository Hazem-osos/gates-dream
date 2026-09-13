import type { QueryClient } from '@tanstack/react-query';
import { fetchApiQuery } from '@/lib/api/query-fetch';
import { isSoftQueryFailure } from '@/lib/api/isAbortError';
import type { QueryParams } from '@/lib/api/types';
import { cachePolicies } from '@/lib/query/cache-policies';

export type PrefetchApiQueryDef = {
  key: readonly unknown[];
  url: string;
  params?: QueryParams;
  staleTime?: number;
  gcTime?: number;
};

export async function prefetchApiQuery<T>(
  queryClient: QueryClient,
  def: PrefetchApiQueryDef
): Promise<void> {
  const params = def.params;
  const staleTime = def.staleTime ?? cachePolicies.defaultQuery.staleTime;
  const gcTime = def.gcTime ?? cachePolicies.defaultQuery.gcTime;

  try {
    await queryClient.prefetchQuery({
      queryKey: [...def.key, params],
      queryFn: ({ signal }) => fetchApiQuery<T>(def.url, params, signal),
      staleTime,
      gcTime,
    });
  } catch (error) {
    if (isSoftQueryFailure(error)) return;
    throw error;
  }
}

export async function prefetchApiQueries(
  queryClient: QueryClient,
  defs: PrefetchApiQueryDef[]
): Promise<void> {
  await Promise.allSettled(defs.map((d) => prefetchApiQuery(queryClient, d)));
}
