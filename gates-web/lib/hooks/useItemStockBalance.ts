import { useApiQuery } from '@/lib/hooks/useApi';

export type ItemStockBalancePayload = {
  itemId: string;
  warehouseId: string;
  warehouseName?: string;
  warehouseCode?: string;
  quantityOnHand?: number;
  reservedQuantity?: number;
  availableQuantity: number;
};

/** Live warehouse stock from item_warehouse_balances (not a movement aggregate). */
export function useItemStockBalance(itemId: string | null, warehouseId: string | null | undefined) {
  const enabled = Boolean(itemId && warehouseId);
  return useApiQuery<ItemStockBalancePayload>(
    ['item-stock-balance', itemId ?? 'none', warehouseId ?? 'none'],
    enabled ? `/inventory/items/${itemId}/stock-balance` : '/inventory/items',
    enabled ? { warehouseId: warehouseId! } : undefined,
    {
      enabled,
      staleTime: 15_000,
      refetchOnWindowFocus: true,
    }
  );
}
