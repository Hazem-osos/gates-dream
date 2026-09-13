'use client';

import { useApiQuery } from '@/lib/hooks/useApi';

export type ItemQuickPeekData = {
  itemId: string;
  itemName: string;
  warehouses: Array<{
    warehouseId: string;
    warehouseName: string;
    warehouseCode: string | null;
    branchName: string | null;
    quantity: number;
    reservedQuantity?: number;
    availableQuantity?: number;
  }>;
  customerPriceHistory: Array<{
    date: string;
    invoiceNumber: string | null;
    unitPrice: number;
    quantity: number;
    discount: number;
  }>;
  cost: { unitCost: number; costMethodLabel: string };
  margin: { sellingPrice: number; marginAmount: number; marginPct: number | null };
  reorder: { orderLimit: number | null; lowerLimit: number | null };
  pendingPurchaseOrders: {
    totalOpenQty: number;
    lines: Array<{ orderNumber: string | null; date: string; openQty: number }>;
  };
};

export function useItemQuickPeek(
  itemId: string | null,
  opts?: { customerId?: string; unitPrice?: number; enabled?: boolean }
) {
  const enabled = Boolean(itemId && (opts?.enabled ?? true));
  return useApiQuery<ItemQuickPeekData>(
    ['item-quick-peek', itemId ?? '', opts?.customerId ?? '', String(opts?.unitPrice ?? '')],
    `/inventory/items/${itemId}/quick-peek`,
    {
      ...(opts?.customerId ? { customerId: opts.customerId } : {}),
      ...(opts?.unitPrice != null ? { unitPrice: String(opts.unitPrice) } : {}),
    },
    { enabled }
  );
}
