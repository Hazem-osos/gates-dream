'use client';

import { useApiQuery } from '@/lib/hooks/useApi';

export type FrequentCustomerItem = {
  itemId: string;
  arabicName: string;
  code: string | null;
  serial: string | null;
  lastUnitPrice: number;
  purchaseCount: number;
};

export function useCustomerFrequentItems(customerId: string | undefined) {
  return useApiQuery<FrequentCustomerItem[]>(
    ['customer-frequent-items', customerId ?? ''],
    customerId ? `/customers/${customerId}/frequent-items` : '/customers/__none__/frequent-items',
    undefined,
    { enabled: !!customerId, staleTime: 60_000 }
  );
}
