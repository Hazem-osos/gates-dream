import type { ApiResponse } from '@/lib/api/types';
import {
  buildSandboxAging,
  buildSandboxAnalytics,
  buildSandboxKpis,
  buildSandboxOverview,
} from '@/lib/onboarding/demo-sandbox-data';
import { useSandboxMode } from '@/lib/hooks/useOnboardingState';
import { useApiQuery } from './useApi';

export type ExecutiveKpis = {
  periodTotals: {
    monthlySales: number;
    monthlyPurchases: number;
    netProfitLoss: number;
    month: string;
  };
  monthlyTrend: {
    salesByMonth: Record<string, number>;
    purchaseByMonth: Record<string, number>;
  };
  cashAndBankLiquidity: number;
  topCustomers: Array<{ customerId: string; customerName: string; revenue: number }>;
  topProducts: Array<{
    itemId: string | null;
    itemName: string | null;
    quantity: number;
    revenue: number;
  }>;
  pendingDocuments: {
    unpostedJournalEntries: number;
    unpostedInvoices: number;
    unpostedTreasuryTransactions: number;
    total: number;
  };
};

export type AgingSummary = {
  summary: { totalOutstanding: number; partyCount: number };
  parties: unknown[];
};

function overlaySandboxData<T>(
  query: ReturnType<typeof useApiQuery<T>>,
  sandboxMode: boolean,
  demo: T
) {
  if (!sandboxMode) return query;
  const data: ApiResponse<T> = { status: 'success', data: demo };
  return { ...query, isLoading: false, isFetching: false, isError: false, error: null, data };
}

export function useExecutiveKpis(months = 6) {
  const query = useApiQuery<ExecutiveKpis>(
    ['executive-kpis', String(months)],
    '/analytics/executive-kpis',
    { months },
    {
      refetchInterval: 120_000,
      retry: 1,
      requireFullTenant: false,
      requestTimeout: 90_000,
    }
  );
  return overlaySandboxData(query, useSandboxMode(), buildSandboxKpis());
}

// M15 fix: `new Date().toISOString().slice(0, 10)` floors to the *UTC*
// calendar day, not the user's local one — for a few hours around local
// midnight (e.g. Egypt, UTC+2/+3) this silently sends "yesterday" as the
// aging report's `asOfDate`. Build the date-only string from local
// getters instead so the default always matches what the user sees on
// their own clock.
function todayLocalDateOnly(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function useAgingSummary(partyType: 'CUSTOMER' | 'SUPPLIER') {
  const asOf = todayLocalDateOnly();
  const query = useApiQuery<AgingSummary>(
    ['aging', partyType, asOf],
    '/analytics/aging',
    { partyType, asOfDate: asOf },
    { retry: 1, requireFullTenant: false, requestTimeout: 90_000 }
  );
  return overlaySandboxData(query, useSandboxMode(), buildSandboxAging(partyType));
}

export function formatMoney(value: number, currency = 'EGP') {
  try {
    return new Intl.NumberFormat('ar-EG', {
      style: 'currency',
      currency,
      maximumFractionDigits: 0,
    }).format(value);
  } catch {
    return value.toLocaleString('ar-EG');
  }
}

export function trendMonths(
  salesByMonth: Record<string, number>,
  purchaseByMonth: Record<string, number>
) {
  const keys = new Set([...Object.keys(salesByMonth), ...Object.keys(purchaseByMonth)]);
  return [...keys]
    .sort()
    .map((month) => ({
      month,
      sales: salesByMonth[month] ?? 0,
      purchases: purchaseByMonth[month] ?? 0,
    }));
}

export type ExecutiveOverview = {
  liquidity: {
    netAvailable: number;
    safes: number;
    banks: number;
    sparkline: number[];
  };
  monthlyPerformance: {
    revenue: number;
    grossProfit: number;
    grossMarginPct: number;
    revenueGrowthPctVsLastMonth: number;
    sparkline: number[];
  };
  receivables: {
    total: number;
    current: number;
    overdueOver60Days: number;
    sparkline: number[];
  };
  shortTermCommitments: {
    total: number;
    supplierApDue14Days: number;
    outwardChequesDue14Days: number;
  };
  chequesPipeline: {
    inwardDueThisWeek: { count: number; amount: number };
    outwardDueNext7Days: { count: number; amount: number };
    sparkline: number[];
  };
  monthlyCashFlow: Array<{ month: string; inflow: number; expense: number }>;
  dailyMilestone?: {
    todaySales: number;
    dailySalesTarget: number;
    targetReached: boolean;
  };
  asOf: string;
};

export type ExecutiveRiskFlag = {
  id: string;
  severity: 'high' | 'medium' | 'low';
  category: string;
  title: string;
  detail: string;
  actionLabel?: string;
  href?: string;
  meta?: Record<string, unknown>;
};

export type ExecutiveRiskFeed = {
  generatedAt: string;
  flags: ExecutiveRiskFlag[];
};

export type ExecutiveAnalytics = {
  topProfitableItems: Array<{
    itemId: string;
    name: string;
    grossProfit: number;
    revenue: number;
  }>;
  topClientsByCollection: Array<{
    customerId: string;
    customerName: string;
    collectedAmount: number;
  }>;
  costCenterRanking: Array<{
    costCenterId: string;
    name: string;
    revenue: number;
    cost: number;
    profit: number;
    budget: number | null;
    budgetUtilizationPct: number | null;
  }>;
  branchHealth: Array<{
    branchId: string | null;
    name: string | null | undefined;
    revenue: number;
  }>;
  periodDays: number;
};

export function useExecutiveOverview() {
  const query = useApiQuery<ExecutiveOverview>(
    ['executive-overview'],
    '/executive/overview',
    undefined,
    { refetchInterval: 120_000, retry: 1 }
  );
  return overlaySandboxData(query, useSandboxMode(), buildSandboxOverview());
}

export function useExecutiveRiskFeed() {
  return useApiQuery<ExecutiveRiskFeed>(
    ['executive-risk-feed'],
    '/executive/risk-feed',
    undefined,
    { refetchInterval: 60_000, retry: 1 }
  );
}

export function useExecutiveAnalytics() {
  const query = useApiQuery<ExecutiveAnalytics>(
    ['executive-analytics'],
    '/executive/analytics',
    undefined,
    { refetchInterval: 180_000, retry: 1 }
  );
  return overlaySandboxData(query, useSandboxMode(), buildSandboxAnalytics());
}

export function trendPctLabel(value: number): string {
  if (value > 0) return `↑ ${Math.abs(value).toFixed(1)}% vs الشهر الماضي`;
  if (value < 0) return `↓ ${Math.abs(value).toFixed(1)}% vs الشهر الماضي`;
  return '— vs الشهر الماضي';
}
