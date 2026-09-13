import { apiClient } from '@/lib/api/client';
import { getTenantContext, isMutationTenantReady } from '@/lib/tenant/tenant-context-storage';
import type { ApiError, ApiResponse, QueryParams } from '@/lib/api/types';
import {
  notifyApiSuccess,
  DEFAULT_SAVE_SUCCESS_MESSAGE,
} from '@/lib/api/api-success-notify';
import type { UseApiMutationExtraOptions } from '@/lib/hooks/useApi';
import {
  useOptimisticMutation,
  type UseOptimisticMutationOptions,
} from '@/lib/hooks/useOptimisticMutation';

async function runApiMutation<TData, TVariables>(
  url: string,
  method: 'POST' | 'PUT' | 'PATCH' | 'DELETE',
  variables: TVariables
): Promise<ApiResponse<TData>> {
  const ctx = getTenantContext();
  if (!isMutationTenantReady(url, ctx)) {
    throw Object.assign(
      new Error('سياق الشركة/الفرع/السنة المالية غير جاهز بعد. انتظر لحظة ثم أعد المحاولة.'),
      { status: 'error' as const, code: '428' }
    ) as ApiError;
  }
  switch (method) {
    case 'POST':
      return apiClient.post<TData>(url, variables);
    case 'PUT':
      return apiClient.put<TData>(url, variables);
    case 'PATCH':
      return apiClient.patch<TData>(url, variables);
    case 'DELETE':
      return apiClient.delete<TData>(url, variables as QueryParams);
    default:
      throw new Error(`Unsupported method: ${method}`);
  }
}

/** Do not use for invoice/treasury/journal post, unpost, or delete. */
export function useOptimisticApiMutation<TData = unknown, TVariables = unknown>(
  url: string,
  method: 'POST' | 'PUT' | 'PATCH' | 'DELETE' = 'POST',
  options?: UseOptimisticMutationOptions<TData, TVariables, { rollback: () => void }> &
    UseApiMutationExtraOptions
) {
  const {
    onError: userOnError,
    onSuccess: userOnSuccess,
    showSuccessToast,
    successMessage,
    ...rest
  } = options ?? {};

  const shouldToast =
    showSuccessToast !== false &&
    (method === 'POST' || method === 'PUT' || method === 'PATCH');

  return useOptimisticMutation<TData, TVariables>(
    (variables) => runApiMutation<TData, TVariables>(url, method, variables),
    {
      ...rest,
      onSuccess: (data, variables, context, meta) => {
        userOnSuccess?.(data, variables, context, meta);
        if (shouldToast) {
          notifyApiSuccess(successMessage ?? DEFAULT_SAVE_SUCCESS_MESSAGE);
        }
      },
      onError: (error, variables, context, meta) => {
        userOnError?.(error, variables, context, meta);
      },
    }
  );
}
