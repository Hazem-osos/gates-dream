'use client';

import { CalendarClock } from 'lucide-react';
import { useMemo, useState } from 'react';
import { itemUsesExpiryDate, type TrackedItemLike } from '@/lib/invoices/itemTracking';
import type { InvoiceLineBatchAllocation } from '@/lib/invoices/invoiceLineColumns';
import { BatchExpiryAllocationModal } from './BatchExpiryAllocationModal';
import { BatchExpiryIssueModal } from './BatchExpiryIssueModal';
import { formatQty } from '@/lib/subcontracts/money';

type Props = {
  item?: TrackedItemLike | null;
  itemId?: string;
  warehouseId?: string;
  quantity: number;
  batchNumber?: string;
  expiryDate?: string;
  allocations?: InvoiceLineBatchAllocation[];
  readOnly?: boolean;
  mode?: 'receive' | 'issue';
  onChange: (patch: {
    batchNumber?: string;
    expiryDate?: string;
    batchAllocations?: InvoiceLineBatchAllocation[];
  }) => void;
  className?: string;
};

export function BatchExpiryLineTrigger({
  item,
  itemId,
  warehouseId,
  quantity,
  batchNumber,
  expiryDate,
  allocations,
  readOnly,
  mode = 'receive',
  onChange,
  className,
}: Props) {
  const tracked = itemUsesExpiryDate(item);
  const [open, setOpen] = useState(false);

  const summary = useMemo(() => {
    if (allocations?.length) {
      const qty = allocations.reduce((s, a) => s + Number(a.qty || 0), 0);
      return { ok: Math.abs(qty - quantity) <= 0.0001, qty, count: allocations.length };
    }
    if (batchNumber && expiryDate) {
      return { ok: quantity > 0, qty: quantity, count: 1 };
    }
    return { ok: false, qty: 0, count: 0 };
  }, [allocations, batchNumber, expiryDate, quantity]);

  if (!tracked) return null;

  const issueReady = mode === 'issue' && Boolean(itemId && warehouseId);

  return (
    <>
      <button
        type="button"
        title={mode === 'issue' ? 'صرف من التشغيلات' : 'توزيع الصلاحية والتشغيلة'}
        disabled={readOnly || quantity <= 0 || (mode === 'issue' && !issueReady)}
        onClick={() => setOpen(true)}
        className={`inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border ${
          summary.ok
            ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
            : 'border-amber-200 bg-amber-50 text-amber-800'
        } hover:brightness-95 disabled:opacity-40 ${className ?? ''}`}
      >
        <CalendarClock className="h-4 w-4" aria-hidden />
      </button>
      {mode === 'issue' && issueReady ? (
        <BatchExpiryIssueModal
          open={open}
          itemId={itemId!}
          warehouseId={warehouseId!}
          requiredQuantity={quantity}
          initialAllocations={allocations}
          onClose={() => setOpen(false)}
          onConfirm={(next) => {
            const first = next[0];
            onChange({
              batchAllocations: next,
              batchNumber: first?.batchNumber ?? '',
              expiryDate: first?.expiryDate ?? '',
            });
          }}
        />
      ) : (
        <BatchExpiryAllocationModal
          open={open && mode === 'receive'}
          requiredQuantity={quantity}
          initialAllocations={allocations}
          initialBatchNumber={batchNumber}
          initialExpiryDate={expiryDate}
          onClose={() => setOpen(false)}
          onConfirm={(next) => {
            const first = next[0];
            onChange({
              batchAllocations: next,
              batchNumber: first?.batchNumber ?? '',
              expiryDate: first?.expiryDate ?? '',
            });
          }}
        />
      )}
      {summary.count > 0 && !open ? (
        <span className="sr-only">
          {summary.ok ? 'الصلاحية مكتملة' : `موزّع ${formatQty(summary.qty)} من ${formatQty(quantity)}`}
        </span>
      ) : null}
    </>
  );
}
