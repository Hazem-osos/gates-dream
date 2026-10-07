'use client';

import Link from 'next/link';
import { InvoiceLineStockBalanceCell } from '@/components/invoices/InvoiceLineStockBalanceCell';

type Props = {
  itemId?: string;
  warehouseId?: string;
  bomEditHref?: string;
};

/** Stock balance for manufacturing grids — guides setup when warehouse/item is missing. */
export function ManufacturingStockBalanceCell({ itemId, warehouseId, bomEditHref }: Props) {
  if (!itemId) {
    return <span className="text-slate-400">—</span>;
  }
  if (!warehouseId) {
    return (
      <span className="text-xs text-amber-700">
        حدّد مخزن «من» أو «إلى»{' '}
        {bomEditHref ? (
          <Link href={bomEditHref} className="font-semibold text-[#0E78AA] underline">
            أو مخزن النموذج
          </Link>
        ) : null}
      </span>
    );
  }
  return <InvoiceLineStockBalanceCell itemId={itemId} warehouseId={warehouseId} />;
}
