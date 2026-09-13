'use client';

import { useApiMutation, useInvalidateQuery } from '@/lib/hooks/useApi';
import type { ApiError } from '@/lib/api/types';
import { invalidateMasterDataQueries } from '@/lib/hooks/invalidateMasterData';

export type SeedCoaResponse = {
  success: true;
  count: number;
  accountsCreated: number;
  skipped: boolean;
};

export type SeedCoaBody = {
  force?: boolean;
  industry?: string;
};

export function useSeedDefaultCoa(options?: {
  onSuccess?: (data: SeedCoaResponse) => void;
  onError?: (err: ApiError) => void;
}) {
  const invalidate = useInvalidateQuery();

  return useApiMutation<{ success?: boolean; count?: number } & SeedCoaResponse, SeedCoaBody>(
    '/accounting/accounts/seed-defaults',
    'POST',
    {
      showSuccessToast: false,
      onSuccess: (res) => {
        invalidateMasterDataQueries(invalidate);
        const payload = (res.data ?? res) as SeedCoaResponse;
        options?.onSuccess?.(payload);
      },
      onError: options?.onError,
    }
  );
}
