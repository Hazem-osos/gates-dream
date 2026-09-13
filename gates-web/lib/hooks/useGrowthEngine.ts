import { useApiMutation, useApiQuery, useInvalidateQuery } from './useApi';

export type GrowthOpportunity = {
  id: string;
  type: string;
  category: string;
  title: string;
  description: string;
  whyDetected: string;
  status: string;
  priority: string;
  estimatedValue: number;
  actionedValue: number;
  realizedValue: number;
  currencyCode: string;
  entityType: string | null;
  entityId: string | null;
  confidence: number;
  evidence: Record<string, unknown> | null;
  recommendedActions: Array<{ key: string; label: string; href?: string; kind: string }>;
  aiExplanation: string | null;
  createdAt: string;
  actions?: Array<{ id: string; actionKey: string; label: string; notes: string | null; createdAt: string }>;
  attributions?: Array<{
    id: string;
    kind: string;
    label: string;
    amount: number;
    entityType: string;
    entityId: string;
    createdAt: string;
  }>;
};

export type GrowthOverview = {
  currencyCode: string;
  potentialValue: number;
  breakdown: { revenue: number; cashRecovery: number; inventory: number; savings: number };
  counts: { open: number; actioned: number; completed: number; dismissed: number };
  empty: boolean;
  emptyReason: string | null;
  missingData: string[];
  opportunities: GrowthOpportunity[];
};

export type GrowthImpact = {
  potentialValue: number;
  actionedValue: number;
  realizedValue: number;
  influencedRevenue: number;
  cashRecovered: number;
  inventoryRecovered: number;
  estimatedRoiMultiple: number | null;
  subscriptionCost: number;
  labels: { influencedRevenue: string; roi: string };
  highlights: { topOpportunity: { id: string; title: string; realizedValue: number } | null };
  attributions: Array<{
    id: string;
    opportunityId: string;
    kind: string;
    label: string;
    amount: number;
    createdAt: string;
  }>;
};

export function useGrowthOverview() {
  return useApiQuery<GrowthOverview>(['growth', 'overview'], '/growth/overview');
}

export function useGrowthImpact() {
  return useApiQuery<GrowthImpact>(['growth', 'impact'], '/growth/impact');
}

export function useGrowthRefresh() {
  const invalidate = useInvalidateQuery();
  return useApiMutation<GrowthOverview, Record<string, unknown>>('/growth/refresh', 'POST', {
    successMessage: 'تم تحديث فرص النمو',
    onSuccess: () => {
      invalidate(['growth']);
    },
  });
}

export function money(n: number) {
  return n.toLocaleString('ar-EG', { maximumFractionDigits: 0 });
}
