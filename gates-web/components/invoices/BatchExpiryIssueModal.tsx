'use client';

import { useEffect, useMemo, useState } from 'react';
import { CenteredOverlay } from '@/components/erp/CenteredOverlay';
import { Button } from '@/components/ui/button';
import { useApiQuery } from '@/lib/hooks/useApi';
import type { InvoiceLineBatchAllocation } from '@/lib/invoices/invoiceLineColumns';
import { formatQty } from '@/lib/subcontracts/money';

type BatchRow = {
  batchId: string;
  batchNumber: string;
  expiryDate: string | null;
  qty: number;
};

type Props = {
  open: boolean;
  itemId: string;
  warehouseId: string;
  requiredQuantity: number;
  initialAllocations?: InvoiceLineBatchAllocation[];
  onClose: () => void;
  onConfirm: (allocations: InvoiceLineBatchAllocation[]) => void;
};

export function BatchExpiryIssueModal({
  open,
  itemId,
  warehouseId,
  requiredQuantity,
  initialAllocations,
  onClose,
  onConfirm,
}: Props) {
  const { data, isLoading } = useApiQuery<{ batches: BatchRow[] }>(
    ['item-batches', itemId, warehouseId, 'issue-modal'],
    `/inventory/items/${itemId}/batches`,
    { warehouseId },
    { enabled: open && Boolean(itemId && warehouseId) }
  );

  const batches = useMemo(
    () => (data?.data?.batches ?? []).filter((b) => Number(b.qty) > 0.0001),
    [data?.data?.batches]
  );

  const [takeQty, setTakeQty] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    const initial: Record<string, string> = {};
    for (const alloc of initialAllocations ?? []) {
      const match = batches.find(
        (b) =>
          b.batchNumber === alloc.batchNumber &&
          (b.expiryDate || '') === (alloc.expiryDate ? String(alloc.expiryDate).slice(0, 10) : '')
      );
      if (match) initial[match.batchId] = String(alloc.qty);
    }
    setTakeQty(initial);
    setError(null);
  }, [open, initialAllocations, batches]);

  const takenSum = useMemo(() => {
    return batches.reduce((sum, b) => {
      const n = Number(takeQty[b.batchId]);
      return sum + (Number.isFinite(n) && n > 0 ? n : 0);
    }, 0);
  }, [batches, takeQty]);

  const handleOk = () => {
    const required = Number(requiredQuantity);
    if (!Number.isFinite(required) || required <= 0) {
      setError('أدخل كمية السطر أولاً');
      return;
    }
    const allocations: InvoiceLineBatchAllocation[] = [];
    for (const batch of batches) {
      const qty = Number(takeQty[batch.batchId]);
      if (!Number.isFinite(qty) || qty <= 0) continue;
      if (qty > batch.qty + 0.0001) {
        setError(`الكمية المطلوبة من ${batch.batchNumber} أكبر من المتاح (${formatQty(batch.qty)})`);
        return;
      }
      allocations.push({
        batchId: batch.batchId,
        batchNumber: batch.batchNumber === 'بدون رقم' ? '' : batch.batchNumber,
        qty,
        expiryDate: batch.expiryDate ?? undefined,
      });
    }
    if (!allocations.length) {
      setError('وزّع الكمية على تشغيلة واحدة على الأقل');
      return;
    }
    if (Math.abs(takenSum - required) > 0.0001) {
      setError(
        `مجموع الكميات المطلوبة (${formatQty(takenSum)}) يجب أن يساوي كمية السطر (${formatQty(required)}) بالضبط`
      );
      return;
    }
    onConfirm(allocations);
    onClose();
  };

  return (
    <CenteredOverlay open={open} onClose={onClose} width="lg" labelledBy="batch-issue-modal-title">
      <div className="flex max-h-[85vh] flex-col p-6" dir="rtl">
        <h2 id="batch-issue-modal-title" className="text-lg font-bold text-[#0E78AA]">
          صرف من التشغيلات
        </h2>
        <p className="mt-1 text-sm text-slate-500">
          كمية السطر: <span className="font-semibold text-slate-800">{formatQty(requiredQuantity)}</span>
          {' — '}
          الموزّع: <span className="font-semibold">{formatQty(takenSum)}</span>
        </p>
        <div className="mt-4 overflow-auto rounded-xl border border-[#E8F1F6]">
          <table className="min-w-full text-sm">
            <thead className="bg-[#F6FBFD] text-xs text-slate-600">
              <tr>
                <th className="px-3 py-2 text-right">رقم التشغيلة</th>
                <th className="px-3 py-2 text-right">تاريخ الصلاحية</th>
                <th className="px-3 py-2 text-right">الكمية المتاحة</th>
                <th className="px-3 py-2 text-right">الكمية المطلوبة</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={4} className="px-3 py-4 text-center text-slate-500">جاري تحميل التشغيلات…</td>
                </tr>
              ) : !batches.length ? (
                <tr>
                  <td colSpan={4} className="px-3 py-4 text-center text-amber-700">
                    لا توجد تشغيلات بكمية متاحة في هذا المخزن
                  </td>
                </tr>
              ) : (
                batches.map((batch) => (
                  <tr key={batch.batchId} className="border-t border-[#E8F1F6]">
                    <td className="px-3 py-2 font-mono text-xs">{batch.batchNumber}</td>
                    <td className="px-3 py-2">{batch.expiryDate || '—'}</td>
                    <td className="px-3 py-2 tabular-nums">{formatQty(batch.qty)}</td>
                    <td className="px-2 py-1.5">
                      <input
                        type="number"
                        min={0}
                        max={batch.qty}
                        step="0.0001"
                        className="h-9 w-full rounded-lg border border-slate-200 px-2 text-sm tabular-nums"
                        value={takeQty[batch.batchId] ?? ''}
                        onChange={(e) =>
                          setTakeQty((prev) => ({ ...prev, [batch.batchId]: e.target.value }))
                        }
                      />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        {error ? <p className="mt-2 text-sm text-red-600">{error}</p> : null}
        <div className="mt-4 flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onClose}>إلغاء</Button>
          <Button type="button" disabled={!batches.length} onClick={handleOk}>موافق</Button>
        </div>
      </div>
    </CenteredOverlay>
  );
}
