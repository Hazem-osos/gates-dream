'use client';

import {
  useMutation,
  useQueryClient,
  type QueryClient,
  type QueryKey,
  type UseMutationOptions,
  type UseMutationResult,
} from '@tanstack/react-query';
import type { ApiError, ApiResponse } from '@/lib/api/types';

export type OptimisticRollbackContext = {
  rollback: () => void;
};

export type OptimisticMutateArgs<TVariables> = {
  variables: TVariables;
  queryClient: QueryClient;
};

export type UseOptimisticMutationOptions<TData, TVariables, TContext> = Omit<
  UseMutationOptions<ApiResponse<TData>, ApiError, TVariables, TContext>,
  'onMutate'
> & {
  /** Query keys to cancel before applying optimistic updates. */
  cancelQueryKeys?: readonly QueryKey[];
  onOptimistic?: (
    args: OptimisticMutateArgs<TVariables>
  ) => OptimisticRollbackContext | Promise<OptimisticRollbackContext>;
};

/**
 * TanStack Query mutation with snapshot rollback on error (0ms perceived updates).
 *
 * Do not use this hook for financial mutations (invoice post/unpost/delete,
 * treasury vouchers, journal post). Those must wait for the server before
 * flipping posted state or dropping rows from cache.
 */
export function useOptimisticMutation<TData = unknown, TVariables = unknown>(
  mutationFn: (variables: TVariables) => Promise<ApiResponse<TData>>,
  options?: UseOptimisticMutationOptions<TData, TVariables, OptimisticRollbackContext>
): UseMutationResult<ApiResponse<TData>, ApiError, TVariables, OptimisticRollbackContext> {
  const queryClient = useQueryClient();
  const {
    cancelQueryKeys,
    onOptimistic,
    onError: userOnError,
    onSettled: userOnSettled,
    ...rest
  } = options ?? {};

  return useMutation<ApiResponse<TData>, ApiError, TVariables, OptimisticRollbackContext>({
    mutationFn,
    ...rest,
    onMutate: async (variables) => {
      if (cancelQueryKeys?.length) {
        await Promise.all(
          cancelQueryKeys.map((key) => queryClient.cancelQueries({ queryKey: key }))
        );
      }
      const result = await onOptimistic?.({ variables, queryClient });
      return result ?? { rollback: () => undefined };
    },
    onError: (error, variables, context, meta) => {
      context?.rollback?.();
      userOnError?.(error, variables, context, meta);
    },
    onSettled: (data, error, variables, context, meta) => {
      userOnSettled?.(data, error, variables, context, meta);
    },
  });
}
