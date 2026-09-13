'use client';

import { useApiMutation, useInvalidateQuery } from '@/lib/hooks/useApi';
import type { ApiError } from '@/lib/api/types';
import { invalidateMasterDataQueries } from '@/lib/hooks/invalidateMasterData';
import { refreshTenantContextFromApi } from '@/lib/tenant/refresh-tenant-context';
import { notifyTenantContextReady, setTenantContext } from '@/lib/tenant/tenant-context-storage';
import { clearConditionalGetCache } from '@/lib/api/conditional-get-cache';

export type SeedCoaResponse = {
  success: true;
  count: number;
  accountsCreated: number;
  skipped: boolean;
  branchId?: string;
  fiscalYearId?: string;
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
        clearConditionalGetCache();
        invalidateMasterDataQueries(invalidate);
        const payload = (res.data ?? res) as SeedCoaResponse;
        if (payload.branchId || payload.fiscalYearId) {
          setTenantContext({
            ...(payload.branchId ? { branchId: payload.branchId } : {}),
            ...(payload.fiscalYearId ? { fiscalYearId: payload.fiscalYearId } : {}),
          });
          notifyTenantContextReady();
        }
        void refreshTenantContextFromApi().catch(() => undefined);
        options?.onSuccess?.(payload);
      },
      onError: options?.onError,
    }
  );
}
