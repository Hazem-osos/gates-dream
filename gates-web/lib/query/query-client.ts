import { QueryCache, MutationCache, QueryClient, keepPreviousData } from '@tanstack/react-query';
import { isSoftQueryFailure } from '@/lib/api/isAbortError';
import { cachePolicies } from '@/lib/query/cache-policies';

function defaultQueryRetry(failureCount: number, error: unknown): boolean {
  if (isSoftQueryFailure(error)) return false;
  return failureCount < 1;
}

/** Shared TanStack Query client — aborts never toast or hit error boundaries. */
export function createAppQueryClient(): QueryClient {
  return new QueryClient({
    queryCache: new QueryCache({
      onError: (error) => {
        if (isSoftQueryFailure(error)) return;
      },
    }),
    mutationCache: new MutationCache({
      onError: (error) => {
        if (isSoftQueryFailure(error)) return;
      },
    }),
    defaultOptions: {
      queries: {
        staleTime: cachePolicies.defaultQuery.staleTime,
        gcTime: cachePolicies.defaultQuery.gcTime,
        placeholderData: keepPreviousData,
        refetchOnWindowFocus: false,
        refetchOnMount: false,
        retry: defaultQueryRetry,
        throwOnError: () => false,
      },
      mutations: {
        retry: (failureCount, error) => {
          if (isSoftQueryFailure(error)) return false;
          return false;
        },
      },
    },
  });
}
