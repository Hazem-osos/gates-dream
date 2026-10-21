'use client';

import { useEffect, useMemo, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { CenteredOverlay } from '@/components/erp/CenteredOverlay';
import { Button } from '@/components/ui/button';
import type { InvoiceLineBatchAllocation } from '@/lib/invoices/invoiceLineColumns';
import { formatQty } from '@/lib/subcontracts/money';

type DraftRow = {
  key: string;
  batchNumber: string;
  expiryDate: string;
  qty: string;
};

type Props = {
  open: boolean;
  title?: string;
  requiredQuantity: number;
  initialAllocations?: InvoiceLineBatchAllocation[];
  initialBatchNumber?: string;
  initialExpiryDate?: string;
  onClose: () => void;
  onConfirm: (allocations: InvoiceLineBatchAllocation[]) => void;
};

function newRow(): DraftRow {
  return {
    key: `r-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    batchNumber: '',
    expiryDate: '',
    qty: '',
  };
}

function toDraftRows(
  allocations?: InvoiceLineBatchAllocation[],
  batchNumber?: string,
  expiryDate?: string,
  requiredQty?: number
): DraftRow[] {
  if (allocations?.length) {
    return allocations.map((a, i) => ({
      key: `a-${i}-${a.batchNumber}`,
      batchNumber: a.batchNumber ?? '',
      expiryDate: a.expiryDate ? String(a.expiryDate).slice(0, 10) : '',
      qty: a.qty != null ? String(a.qty) : '',
    }));
  }
  if (batchNumber || expiryDate) {
    return [
      {
        key: 'legacy',
        batchNumber: batchNumber ?? '',
        expiryDate: expiryDate ? String(expiryDate).slice(0, 10) : '',
        qty: requiredQty && requiredQty > 0 ? String(requiredQty) : '',
      },
    ];
  }
  return [newRow()];
}

export function BatchExpiryAllocationModal({
  open,
  title = 'توزيع الصلاحية والتشغيلة',
  requiredQuantity,
  initialAllocations,
  initialBatchNumber,
  initialExpiryDate,
  onClose,
  onConfirm,
}: Props) {
  const [rows, setRows] = useState<DraftRow[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setRows(toDraftRows(initialAllocations, initialBatchNumber, initialExpiryDate, requiredQuantity));
    setError(null);
  }, [open, initialAllocations, initialBatchNumber, initialExpiryDate, requiredQuantity]);

  const allocatedSum = useMemo(
    () =>
      rows.reduce((s, r) => {
        const n = Number(r.qty);
        return s + (Number.isFinite(n) && n > 0 ? n : 0);
      }, 0),
    [rows]
  );

  const handleOk = () => {
    const required = Number(requiredQuantity);
    if (!Number.isFinite(required) || required <= 0) {
      setError('أدخل كمية السطر أولاً');
      return;
    }
    const allocations: InvoiceLineBatchAllocation[] = [];
    for (const row of rows) {
      const qty = Number(row.qty);
      if (!Number.isFinite(qty) || qty <= 0) continue;
      const batchNumber = row.batchNumber.trim();
      if (!batchNumber) {
        setError('رقم التشغيلة مطلوب لكل صف');
        return;
      }
      if (!row.expiryDate.trim()) {
        setError('تاريخ الصلاحية مطلوب لكل صف');
        return;
      }
      allocations.push({
        batchNumber,
        qty,
        expiryDate: row.expiryDate,
      });
    }
    if (!allocations.length) {
      setError('أضف صفاً واحداً على الأقل');
      return;
    }
    if (Math.abs(allocatedSum - required) > 0.0001) {
      setError(
        `مجموع كميات الباتش (${formatQty(allocatedSum)}) يجب أن يساوي كمية السطر (${formatQty(required)}) بالضبط`
      );
      return;
    }
    onConfirm(allocations);
    onClose();
  };

  return (
    <CenteredOverlay open={open} onClose={onClose} width="lg" labelledBy="batch-expiry-modal-title">
      <div className="flex max-h-[85vh] flex-col p-6" dir="rtl">
        <h2 id="batch-expiry-modal-title" className="text-lg font-bold text-[#0E78AA]">{title}</h2>
        <p className="mt-1 text-sm text-slate-500">
          كمية السطر: <span className="font-semibold text-slate-800">{formatQty(requiredQuantity)}</span>
          {' — '}
          الموزّع: <span className="font-semibold">{formatQty(allocatedSum)}</span>
        </p>
        <div className="mt-4 overflow-auto rounded-xl border border-[#E8F1F6]">
          <table className="min-w-full text-sm">
            <thead className="bg-[#F6FBFD] text-xs text-slate-600">
              <tr>
                <th className="px-3 py-2 text-right">رقم التشغيلة</th>
                <th className="px-3 py-2 text-right">تاريخ الصلاحية</th>
                <th className="px-3 py-2 text-right">الكمية</th>
                <th className="w-10" />
              </tr>
            </thead>
            <tbody>
              {rows.map((row, index) => (
                <tr key={row.key} className="border-t border-[#E8F1F6]">
                  <td className="px-2 py-1.5">
                    <input
                      className="h-9 w-full rounded-lg border border-slate-200 px-2 text-sm"
                      value={row.batchNumber}
                      onChange={(e) =>
                        setRows((prev) =>
                          prev.map((r, i) => (i === index ? { ...r, batchNumber: e.target.value } : r))
                        )
                      }
                    />
                  </td>
                  <td className="px-2 py-1.5">
                    <input
                      type="date"
                      className="h-9 w-full rounded-lg border border-slate-200 px-2 text-sm"
                      value={row.expiryDate}
                      onChange={(e) =>
                        setRows((prev) =>
                          prev.map((r, i) => (i === index ? { ...r, expiryDate: e.target.value } : r))
                        )
                      }
                    />
                  </td>
                  <td className="px-2 py-1.5">
                    <input
                      type="number"
                      min={0}
                      step="0.0001"
                      className="h-9 w-full rounded-lg border border-slate-200 px-2 text-sm tabular-nums"
                      value={row.qty}
                      onChange={(e) =>
                        setRows((prev) =>
                          prev.map((r, i) => (i === index ? { ...r, qty: e.target.value } : r))
                        )
                      }
                    />
                  </td>
                  <td className="px-1 py-1.5">
                    <button
                      type="button"
                      className="rounded p-1 text-red-600 hover:bg-red-50"
                      aria-label="حذف الصف"
                      onClick={() => setRows((prev) => (prev.length <= 1 ? prev : prev.filter((_, i) => i !== index)))}
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
          <Button type="button" variant="secondary" size="sm" className="gap-1" onClick={() => setRows((p) => [...p, newRow()])}>
            <Plus className="h-4 w-4" />
            صف جديد
          </Button>
          {error ? <p className="text-sm text-red-600">{error}</p> : null}
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onClose}>إلغاء</Button>
          <Button type="button" onClick={handleOk}>موافق</Button>
        </div>
      </div>
    </CenteredOverlay>
  );
}
