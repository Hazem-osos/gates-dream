'use client';

import { useApiMutation, useInvalidateQuery } from '@/lib/hooks/useApi';
import type { ApiError } from '@/lib/api/types';

export type SeedDemoCatalogResponse = {
  itemId: string;
  unitId: string;
  warehouseId: string;
  customerId: string;
  created: { item: boolean; customer: boolean; stock: boolean };
};

export function useSeedDemoCatalog(options?: {
  onSuccess?: (data: SeedDemoCatalogResponse) => void;
  onError?: (err: ApiError) => void;
}) {
  const invalidate = useInvalidateQuery();

  return useApiMutation<{ data?: SeedDemoCatalogResponse } & SeedDemoCatalogResponse, Record<string, never>>(
    '/inventory/items/seed-demo-catalog',
    'POST',
    {
      onSuccess: (res) => {
        invalidate(['items']);
        invalidate(['customers']);
        const payload = (res.data ?? res) as SeedDemoCatalogResponse;
        options?.onSuccess?.(payload);
      },
      onError: options?.onError,
      showSuccessToast: false,
    }
  );
}
