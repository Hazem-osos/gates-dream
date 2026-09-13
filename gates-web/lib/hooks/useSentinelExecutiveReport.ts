'use client';

import { useApiQuery } from '@/lib/hooks/useApi';
import { queryKeys } from '@/lib/query/query-keys';

export type SentinelSeverity = 'info' | 'warn' | 'crit';

export type VoidPatternFlag = {
  type: 'VOID_PATTERN';
  severity: SentinelSeverity;
  userId: string;
  userName: string;
  cancelledVolume: number;
  totalVolume: number;
  voidRate: number;
  cancelledCount: number;
  totalCount: number;
  inspectHref: string;
};

export type BackdatedInvoiceFlag = {
  type: 'BACKDATED_INVOICE';
  severity: SentinelSeverity;
  invoiceId: string;
  invoiceNumber: string;
  userId: string | null;
  userName: string;
  invoiceDate: string;
  createdAt: string;
  lagDays: number;
  inspectHref: string;
};

export type ShortageWriteoffFlag = {
  type: 'REPEATED_SHORTAGE';
  severity: SentinelSeverity;
  itemId: string;
  itemName: string;
  itemCode: string | null;
  eventCount: number;
  totalShortageQty: number;
  windowDays: number;
  inspectHref: string;
};

export type ReplacementCostFlag = {
  type: 'BELOW_REPLACEMENT';
  severity: SentinelSeverity;
  itemId: string;
  itemName: string;
  invoiceId: string;
  invoiceNumber: string;
  salePrice: number;
  replacementCost: number;
  averageCost: number;
  suggestedSalePrice: number;
  soldAboveAverageCost: boolean;
  inspectHref: string;
};

export type ContractingCashGapFlag = {
  type: 'CONTRACTING_CASH_GAP';
  severity: SentinelSeverity;
  projectId: string;
  projectName: string;
  projectCode: string;
  subcontractorDue21d: number;
  ownerInflow21d: number;
  liquidAvailable: number;
  gap: number;
  inspectHref: string;
};

export type SentinelExecutiveReport = {
  generatedAt: string;
  asOf: string;
  source: 'live' | 'cache' | 'scheduled';
  narrative: string;
  narrativeSource: 'ai' | 'fallback';
  model: string;
  counts: { fraud: number; replacement: number; cashflow: number };
  fraud: {
    voidPatterns: VoidPatternFlag[];
    backdated: BackdatedInvoiceFlag[];
    shortages: ShortageWriteoffFlag[];
  };
  replacement: ReplacementCostFlag[];
  cashflow: {
    liquidBank: number;
    liquidTreasury: number;
    liquidTotal: number;
    totalSubcontractorDue21d: number;
    totalOwnerInflow21d: number;
    companyGap: number;
    horizonDays: number;
    projects: ContractingCashGapFlag[];
  };
};

export function useSentinelExecutiveReport(enabled = true) {
  const q = useApiQuery<SentinelExecutiveReport>(
    queryKeys.ai.sentinelReport(),
    '/ai/sentinel/executive-report',
    undefined,
    { staleTime: 60_000, retry: 1, enabled }
  );

  return {
    ...q,
    report: q.data?.data,
  };
}
