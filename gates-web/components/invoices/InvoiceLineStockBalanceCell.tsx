'use client';

import { useItemStockBalance } from '@/lib/hooks/useItemStockBalance';

type Props = {
  itemId?: string;
  warehouseId?: string;
  fallbackOnHand?: number | null;
};

function formatQty(n: number) {
  return n.toLocaleString('ar-EG', { maximumFractionDigits: 3 });
}

/** Live warehouse stock for an invoice line (read-only). */
export function InvoiceLineStockBalanceCell({ itemId, warehouseId, fallbackOnHand }: Props) {
  const { data, isLoading } = useItemStockBalance(itemId || null, warehouseId);
  const live = data?.data?.availableQuantity ?? data?.data?.quantityOnHand;
  const qty = live ?? (fallbackOnHand != null ? Number(fallbackOnHand) : null);

  if (!itemId) {
    return <span className="text-slate-400">—</span>;
  }
  if (qty == null && isLoading) {
    return <span className="text-slate-400">…</span>;
  }
  if (qty == null || !Number.isFinite(qty)) {
    return <span className="text-slate-400">—</span>;
  }

  const tone = qty <= 0 ? 'text-red-600' : 'text-[#0A3D5E]';
  return (
    <span className={`tabular-nums font-semibold ${tone}`} title="الرصيد المتاح في المخزن">
      {formatQty(qty)}
    </span>
  );
}
