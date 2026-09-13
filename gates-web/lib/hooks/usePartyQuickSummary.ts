'use client';

import { useApiQuery } from '@/lib/hooks/useApi';

export type PartyQuickSummary = {
  partyId: string;
  partyType: 'CUSTOMER' | 'SUPPLIER';
  displayName: string;
  code: string | null;
  phone: string | null;
  balance: number;
  creditLimit: number | null;
  creditUsedPercent: number | null;
  openInvoicesCount: number;
  riskBadge: string;
  riskLabelAr: string;
};

export function usePartyQuickSummary(
  partyId: string | null | undefined,
  partyType: 'CUSTOMER' | 'SUPPLIER',
  enabled: boolean
) {
  return useApiQuery<PartyQuickSummary>(
    ['party-quick-summary', partyType, partyId],
    partyId ? `/parties/${partyId}/quick-summary` : '/parties/_',
    partyId ? { partyType } : undefined,
    {
      enabled: Boolean(enabled && partyId),
      staleTime: 60_000,
    }
  );
}
