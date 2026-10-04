import { toFiniteNumber } from '@/components/dashboard/period';

export const REORDER_PURCHASE_ORDER_HREF = '/inventory/operations/purchase-order?from=order-limit';

export type ReorderCandidate = {
  id: string;
  arabicName?: string | null;
  onHandQuantity?: number | string | null;
  orderLimit?: number | string | null;
  lowerLimit?: number | string | null;
  reorderPoint?: number | string | null;
  lastPurchasePrice?: number | string | null;
};

export function orderLimitOf(item: ReorderCandidate): number {
  return toFiniteNumber(item.orderLimit || item.lowerLimit || item.reorderPoint);
}

/** Stock is at or under the reorder point, and a reorder point is set. */
export function isAtOrderLimit(item: ReorderCandidate): boolean {
  const limit = orderLimitOf(item);
  return limit > 0 && toFiniteNumber(item.onHandQuantity) <= limit;
}

/** Quantity that brings stock back to the reorder point, at least 1. */
export function reorderPurchaseQuantity(item: ReorderCandidate): number {
  const gap = orderLimitOf(item) - toFiniteNumber(item.onHandQuantity);
  return gap > 0 ? gap : 1;
}
