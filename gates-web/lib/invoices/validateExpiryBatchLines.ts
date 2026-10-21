import type { InvoiceLineBatchAllocation } from '@/lib/invoices/invoiceLineColumns';
import { itemUsesExpiryDate, type TrackedItemLike } from '@/lib/invoices/itemTracking';

const QTY_EPS = 0.0001;

export function expiryBatchLinesValid(
  lines: Array<{
    itemId: string;
    quantity: number;
    batchAllocations?: InvoiceLineBatchAllocation[];
    batchNumber?: string;
    expiryDate?: string;
  }>,
  items: Array<TrackedItemLike & { id: string; arabicName?: string }>
): string | null {
  const byId = new Map(items.map((i) => [i.id, i]));
  for (const line of lines) {
    if (!line.itemId || !(line.quantity > 0)) continue;
    const item = byId.get(line.itemId);
    if (!item || !itemUsesExpiryDate(item)) continue;
    const alloc = line.batchAllocations?.filter((a) => Number(a.qty) > 0) ?? [];
    const sum = alloc.reduce((s, a) => s + Number(a.qty || 0), 0);
    if (alloc.length) {
      if (Math.abs(sum - line.quantity) > QTY_EPS) {
        return `توزيع الصلاحية للصنف «${item.arabicName ?? ''}» لا يطابق كمية السطر`;
      }
      continue;
    }
    if (!line.batchNumber?.trim() || !line.expiryDate) {
      return `الصنف «${item.arabicName ?? ''}» خاضع للصلاحية — حدّد التشغيلات من الأيقونة`;
    }
  }
  return null;
}
