'use client';

import { useItemStockBalance } from '@/lib/hooks/useItemStockBalance';

type Props = {
  itemId?: string;
  warehouseId?: string;
  fallbackOnHand?: number | null;
  /** Stocktaking compares physical on-hand; sales lines use saleable (available). */
  displayMode?: 'available' | 'onHand';
};

function formatQty(n: number) {
  return n.toLocaleString('ar-EG', { maximumFractionDigits: 3 });
}

/** Live warehouse stock for an invoice line (read-only). Shows saleable (available) qty. */
export function InvoiceLineStockBalanceCell({
  itemId,
  warehouseId,
  fallbackOnHand,
  displayMode = 'available',
}: Props) {
  const { data, isLoading } = useItemStockBalance(itemId || null, warehouseId);
  const onHand = data?.data?.quantityOnHand;
  const reserved = data?.data?.reservedQuantity;
  const available = data?.data?.availableQuantity;
  const live =
    displayMode === 'onHand'
      ? onHand != null && Number.isFinite(Number(onHand))
        ? Number(onHand)
        : undefined
      : available != null && Number.isFinite(Number(available))
        ? Number(available)
        : onHand != null && Number.isFinite(Number(onHand))
          ? Number(onHand)
          : undefined;
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
  const titleParts = ['المتاح للبيع: ' + formatQty(qty)];
  if (onHand != null && Number.isFinite(Number(onHand))) {
    titleParts.push('الموجود: ' + formatQty(Number(onHand)));
  }
  if (reserved != null && Number(reserved) > 0) {
    titleParts.push('المحجوز: ' + formatQty(Number(reserved)));
  }
  return (
    <span className={`tabular-nums font-semibold ${tone}`} title={titleParts.join(' · ')}>
      {formatQty(qty)}
    </span>
  );
}
