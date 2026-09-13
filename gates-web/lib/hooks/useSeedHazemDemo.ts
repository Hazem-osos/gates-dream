'use client';

import { useApiMutation, useInvalidateQuery } from '@/lib/hooks/useApi';
import type { ApiError } from '@/lib/api/types';
import { invalidateMasterDataQueries } from '@/lib/hooks/invalidateMasterData';

export type SeedHazemDemoResponse = {
  userId: string;
  companyId: string;
  branchId: string;
  fiscalYearId: string;
  masters: Record<string, number>;
  skippedTransactions: boolean;
};

export function useSeedHazemDemo(options?: {
  onSuccess?: (data: SeedHazemDemoResponse) => void;
  onError?: (err: ApiError) => void;
}) {
  const invalidate = useInvalidateQuery();

  return useApiMutation<
    { data?: SeedHazemDemoResponse },
    { forceTransactions?: boolean }
  >('/demo/seed-hazem', 'POST', {
    onSuccess: (res) => {
      invalidateMasterDataQueries(invalidate);
      invalidate(['customers']);
      invalidate(['suppliers']);
      invalidate(['securities-receipts']);
      invalidate(['invoices']);
      invalidate(['coa-tree']);
      const payload = (res.data ?? res) as SeedHazemDemoResponse;
      options?.onSuccess?.(payload);
    },
    onError: options?.onError,
    successMessage: 'تم تحميل بيانات العرض التجريبية',
  });
}
