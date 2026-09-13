'use client';

import { useApiQuery } from '@/lib/hooks/useApi';
import { staleTimes } from '@/lib/query/query-keys';

export type CompanyGlDefaults = {
  inventoryAccountId: string | null;
  salesAccountId: string | null;
  cogsAccountId: string | null;
  arAccountId: string | null;
  apAccountId: string | null;
  cashAccountId: string | null;
  bankAccountId: string | null;
  salesReturnAccountId: string | null;
  vatAccountId: string | null;
  retainedEarningsAccountId: string | null;
  underCollectionChequeAccountId: string | null;
  purchaseAccountId?: string | null;
  salesDiscountAccountId?: string | null;
};

export function useCompanyGlDefaults() {
  return useApiQuery<CompanyGlDefaults>(
    ['gl-defaults'],
    '/accounting/accounts/gl-defaults',
    undefined,
    { staleTime: staleTimes.masterMs }
  );
}
