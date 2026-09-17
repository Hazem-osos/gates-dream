/**
 * Base API Hooks
 * Wrapper hooks for React Query integration
 */

import {
  useQuery,
  useMutation,
  useQueryClient,
  UseQueryOptions,
  UseMutationOptions,
  keepPreviousData,
} from '@tanstack/react-query';
import { apiClient } from '../api/client';
import { isSoftQueryFailure } from '../api/isAbortError';
import { fetchApiQuery } from '../api/query-fetch';
import { ApiResponse, QueryParams, ApiError } from '../api/types';
import { useTenantContextReady, useCompanyContextReady } from './useTenantContextReady';
import { getTenantContext, isMutationTenantReady } from '../tenant/tenant-context-storage';
import { bumpMasterCatalog, isMasterCatalogKey } from '@/lib/query/master-catalog-sync';

export type UseApiMutationExtraOptions = {
  /** Set to `false` to skip the global green success toast. Default: show for POST/PUT/PATCH. */
  showSuccessToast?: boolean;
  /** Custom success message; defaults to «تم الحفظ». */
  successMessage?: string;
};

// Wave 5 fix: `apiClient`'s `handleResponse` already calls `notifyApiError`
// for every broadcastable status on every request (GET included), so a
// second call from here duplicated the toast for any mutation whose error
// matched `shouldBroadcastApiError`. Now that more statuses broadcast
// (400/409/422/500), that duplication would show every conflict/validation
// error twice — removed in favor of the single source of truth in
// `client.ts`.

/**
 * Generic useQuery hook wrapper
 */
type ApiQueryHookOptions<T> = Omit<UseQueryOptions<ApiResponse<T>, ApiError>, 'queryKey' | 'queryFn'> & {
  requireFullTenant?: boolean;
  requestTimeout?: number;
  skipErrorNotify?: boolean;
};

function pickQueryOptions<T>(options?: ApiQueryHookOptions<T>) {
  if (!options) {
    return {} as Omit<ApiQueryHookOptions<T>, 'requireFullTenant' | 'requestTimeout' | 'skipErrorNotify'>;
  }
  const rest = { ...options };
  delete rest.requireFullTenant;
  delete rest.requestTimeout;
  delete rest.skipErrorNotify;
  return rest as Omit<ApiQueryHookOptions<T>, 'requireFullTenant' | 'requestTimeout' | 'skipErrorNotify'>;
}

export function useApiQuery<T>(
  key: readonly unknown[],
  url: string,
  params?: QueryParams,
  options?: ApiQueryHookOptions<T>
) {
  const tenantReady = useTenantContextReady();
  const companyReady = useCompanyContextReady();
  const requireFullTenant = options?.requireFullTenant !== false;
  const userEnabled = options?.enabled ?? true;
  const userRetry = options?.retry;
  const requestTimeout = options?.requestTimeout;
  const skipErrorNotify = options?.skipErrorNotify === true;

  const queryOptions = pickQueryOptions(options);

  return useQuery<ApiResponse<T>, ApiError>({
    placeholderData: keepPreviousData,
    ...queryOptions,
    queryKey: [...key, params],
    queryFn: async ({ signal }) =>
      fetchApiQuery<T>(url, params, signal, {
        ...(requestTimeout != null ? { timeout: requestTimeout } : {}),
        ...(skipErrorNotify ? { skipErrorNotify: true } : {}),
      }),
    retry: (failureCount, error) => {
      if (isSoftQueryFailure(error)) return false;
      if (userRetry === false) return false;
      if (typeof userRetry === 'number') return failureCount < userRetry;
      if (typeof userRetry === 'function') return userRetry(failureCount, error);
      return failureCount < 1;
    },
    throwOnError: (error, query) => {
      if (isSoftQueryFailure(error)) return false;
      const userThrow = queryOptions?.throwOnError;
      if (typeof userThrow === 'function') return userThrow(error, query);
      if (userThrow === true) return true;
      return false;
    },
    enabled: userEnabled && (requireFullTenant ? tenantReady : companyReady),
  });
}

/**
 * Generic useMutation hook wrapper
 */
export function useApiMutation<TData = unknown, TVariables = unknown>(
  url: string,
  method: 'POST' | 'PUT' | 'PATCH' | 'DELETE' = 'POST',
  options?: Omit<
    UseMutationOptions<ApiResponse<TData>, ApiError, TVariables>,
    'mutationFn'
  > &
    UseApiMutationExtraOptions
) {
  const {
    onError: userOnError,
    onSuccess: userOnSuccess,
    showSuccessToast,
    successMessage,
    ...restOptions
  } = options ?? {};

  const mutationNotify = {
    skipSuccessNotify: showSuccessToast === false,
    successMessage,
  };

  return useMutation<ApiResponse<TData>, ApiError, TVariables>({
    mutationFn: async (variables: TVariables) => {
      const ctx = getTenantContext();
      if (!isMutationTenantReady(url, ctx)) {
        throw Object.assign(
          new Error('سياق الشركة/الفرع/السنة المالية غير جاهز بعد. انتظر لحظة ثم أعد المحاولة.'),
          { status: 'error' as const, code: '428' }
        ) as ApiError;
      }
      switch (method) {
        case 'POST':
          return apiClient.post<TData>(url, variables, mutationNotify);
        case 'PUT':
          return apiClient.put<TData>(url, variables, mutationNotify);
        case 'PATCH':
          return apiClient.patch<TData>(url, variables, mutationNotify);
        case 'DELETE':
          return apiClient.delete<TData>(url, variables as QueryParams, mutationNotify);
        default:
          throw new Error(`Unsupported method: ${method}`);
      }
    },
    ...restOptions,
    onSuccess: (data, variables, onMutateResult, context) => {
      userOnSuccess?.(data, variables, onMutateResult, context);
    },
    onError: (error, variables, onMutateResult, context) => {
      userOnError?.(error, variables, onMutateResult, context);
      if (isSoftQueryFailure(error)) return;
      if (!userOnError && process.env.NODE_ENV === 'development') {
        console.warn(`[useApiMutation] ${method} ${url} failed:`, error.message);
      }
    },
  });
}

/**
 * Hook to invalidate queries
 */
export function useInvalidateQuery() {
  const queryClient = useQueryClient();

  return (queryKey: readonly unknown[]) => {
    if (isMasterCatalogKey(queryKey)) {
      bumpMasterCatalog(String(queryKey[0]));
    }
    queryClient.invalidateQueries({ queryKey, refetchType: 'all' });
  };
}

