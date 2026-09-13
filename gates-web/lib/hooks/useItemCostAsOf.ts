import { useApiQuery } from '@/lib/hooks/useApi';

/** Moving / as-of unit cost from Wave 0 inventory cost engine. */
export function useItemCostAsOf(itemId: string | null, asOfDate?: string) {
  const date = asOfDate ?? new Date().toISOString().split('T')[0];
  return useApiQuery<{ unitCost?: number; movingAverageCost?: number }>(
    ['item-cost-as-of', itemId ?? 'none', date],
    itemId ? `/inventory/items/${itemId}/cost-as-of` : '/inventory/items',
    itemId ? { date } : undefined,
    { enabled: Boolean(itemId) }
  );
}
