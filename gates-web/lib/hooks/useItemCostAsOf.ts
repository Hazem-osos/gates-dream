import { useApiQuery } from '@/lib/hooks/useApi';

export type ItemCostAsOfPayload = {
  cost?: number;
  unitCost?: number;
  movingAverageCost?: number;
};

/** Moving / as-of unit cost from Wave 0 inventory cost engine. */
export function useItemCostAsOf(itemId: string | null, asOfDate?: string) {
  const date = (asOfDate ?? new Date().toISOString().split('T')[0]).slice(0, 10);
  return useApiQuery<ItemCostAsOfPayload>(
    ['item-cost-as-of', itemId ?? 'none', date],
    itemId ? `/inventory/items/${itemId}/cost-as-of` : '/inventory/items',
    itemId ? { date } : undefined,
    { enabled: Boolean(itemId) }
  );
}

export function itemCostAsOfValue(payload?: ItemCostAsOfPayload | null): number {
  const n = Number(payload?.movingAverageCost ?? payload?.unitCost ?? payload?.cost ?? 0);
  return Number.isFinite(n) && n > 0 ? n : 0;
}
