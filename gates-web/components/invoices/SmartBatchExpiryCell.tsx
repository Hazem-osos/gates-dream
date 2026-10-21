'use client';

import { itemIsBatchTracked, itemUsesExpiryDate, type TrackedItemLike } from '@/lib/invoices/itemTracking';
import type { InvoiceLineBatchAllocation } from '@/lib/invoices/invoiceLineColumns';
import { BatchExpiryLineTrigger } from './BatchExpiryLineTrigger';

type Props = {
  item?: TrackedItemLike | null;
  itemId?: string;
  warehouseId?: string;
  quantity: number;
  batchNumber?: string;
  expiryDate?: string;
  allocations?: InvoiceLineBatchAllocation[];
  onChange: (patch: {
    batchNumber?: string;
    expiryDate?: string;
    productionDate?: string;
    batchAllocations?: InvoiceLineBatchAllocation[];
  }) => void;
  className?: string;
  mode?: 'issue' | 'receive';
  readOnly?: boolean;
};

export function SmartBatchExpiryCell({
  item,
  itemId,
  warehouseId,
  quantity,
  batchNumber,
  expiryDate,
  allocations,
  onChange,
  className,
  mode = 'receive',
  readOnly,
}: Props) {
  if (!itemIsBatchTracked(item) || !itemUsesExpiryDate(item)) {
    return <span className="block px-1 text-center text-slate-400">—</span>;
  }

  return (
    <div className={className}>
      <BatchExpiryLineTrigger
        item={item}
        itemId={itemId}
        warehouseId={warehouseId}
        quantity={quantity}
        batchNumber={batchNumber}
        expiryDate={expiryDate}
        allocations={allocations}
        readOnly={readOnly}
        mode={mode}
        onChange={onChange}
        className="mx-auto"
      />
    </div>
  );
}
