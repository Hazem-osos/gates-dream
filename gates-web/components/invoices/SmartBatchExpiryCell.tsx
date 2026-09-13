'use client';

import { useMemo, useState } from 'react';
import { useApiQuery } from '@/lib/hooks/useApi';
import { itemIsBatchTracked, type TrackedItemLike } from '@/lib/invoices/itemTracking';
import type { InvoiceLineBatchAllocation } from '@/lib/invoices/invoiceLineColumns';

type BatchRow = {
  batchId: string;
  batchNumber: string;
  expiryDate: string | null;
  qty: number;
};

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
}: Props) {
  const tracked = itemIsBatchTracked(item);
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<Record<string, number>>({});

  const enabled = tracked && Boolean(itemId && warehouseId && open);
  const { data, isLoading } = useApiQuery<{ batches: BatchRow[] }>(
    ['item-batches', itemId ?? '', warehouseId ?? ''],
    itemId ? `/inventory/items/${itemId}/batches` : '',
    { warehouseId },
    { enabled }
  );
  const batches = data?.data?.batches ?? [];

  const selected = useMemo(() => {
    if (allocations?.length) {
      const qty = allocations.reduce((s, a) => s + Number(a.qty || 0), 0);
      const label = allocations.map((a) => a.batchNumber).join(' + ');
      return { label, qty, expiry: allocations[0]?.expiryDate ?? expiryDate };
    }
    if (batchNumber) return { label: batchNumber, qty: quantity, expiry: expiryDate };
    return null;
  }, [allocations, batchNumber, expiryDate, quantity]);

  if (!tracked) {
    return <span className="block px-1 text-center text-slate-400">—</span>;
  }

  const applyAllocations = () => {
    const next: InvoiceLineBatchAllocation[] = batches
      .map((b) => ({
        batchId: b.batchId,
        batchNumber: b.batchNumber,
        qty: Number(draft[b.batchId] ?? 0),
        expiryDate: b.expiryDate,
      }))
      .filter((a) => a.qty > 0);
    const first = next[0];
    onChange({
      batchAllocations: next,
      batchNumber: first?.batchNumber ?? '',
      expiryDate: first?.expiryDate ?? '',
    });
    setOpen(false);
  };

  return (
    <div className={`relative ${className ?? ''}`}>
      <button
        type="button"
        onClick={() => {
          const initial: Record<string, number> = {};
          for (const a of allocations ?? []) {
            const match = batches.find((b) => b.batchNumber === a.batchNumber);
            if (match) initial[match.batchId] = a.qty;
          }
          setDraft(initial);
          setOpen((v) => !v);
        }}
        className="inline-flex h-9 w-full items-center justify-between rounded-lg border border-slate-200 bg-white px-2 text-xs font-medium text-[#0B6A96] hover:bg-slate-50"
      >
        <span className="truncate">{selected?.label || 'تحديد الباتش'}</span>
        {selected?.expiry ? (
          <span className="ms-1 rounded-full bg-slate-100 px-1.5 font-mono text-[10px] text-slate-600">
            {selected.expiry}
          </span>
        ) : null}
      </button>
      {open ? (
        <div className="absolute left-0 top-full z-40 mt-1 w-80 rounded-xl border border-slate-200 bg-white p-3 text-right shadow-lg">
          <p className="mb-2 text-[11px] font-semibold text-slate-700">توزيع الكمية على التشغيلات (FEFO)</p>
          {isLoading ? <p className="text-xs text-slate-400">جاري التحميل…</p> : null}
          {!isLoading && batches.length === 0 ? (
            <div className="space-y-2">
              <p className="text-xs text-slate-500">لا توجد تشغيلات سابقة — أدخل يدوياً</p>
              <input
                className="h-8 w-full rounded-md border border-slate-200 px-2 text-xs"
                placeholder="رقم التشغيلة"
                defaultValue={batchNumber}
                onBlur={(e) => onChange({ batchNumber: e.target.value, batchAllocations: [] })}
              />
              <input
                type="date"
                className="h-8 w-full rounded-md border border-slate-200 px-2 text-xs"
                defaultValue={expiryDate}
                onBlur={(e) => onChange({ expiryDate: e.target.value })}
              />
            </div>
          ) : (
            <ul className="max-h-52 space-y-2 overflow-y-auto">
              {batches.map((b) => (
                <li key={b.batchId} className="grid grid-cols-[1fr_4.5rem] items-center gap-2 text-xs">
                  <div>
                    <p className="font-medium text-slate-800">{b.batchNumber}</p>
                    <p className="text-[10px] text-slate-500">
                      صلاحية {b.expiryDate || '—'} · متاح {b.qty.toLocaleString('ar-EG')}
                    </p>
                  </div>
                  <input
                    type="number"
                    min={0}
                    max={b.qty}
                    className="h-8 rounded-md border border-slate-200 px-1 text-center"
                    value={draft[b.batchId] ?? ''}
                    onChange={(e) =>
                      setDraft((prev) => ({ ...prev, [b.batchId]: Number(e.target.value) || 0 }))
                    }
                  />
                </li>
              ))}
            </ul>
          )}
          <div className="mt-3 flex justify-end gap-2">
            <button type="button" className="text-xs text-slate-500" onClick={() => setOpen(false)}>
              إلغاء
            </button>
            {batches.length ? (
              <button
                type="button"
                className="rounded-md bg-[#0E79AA] px-2 py-1 text-xs text-white"
                onClick={applyAllocations}
              >
                تطبيق
              </button>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
