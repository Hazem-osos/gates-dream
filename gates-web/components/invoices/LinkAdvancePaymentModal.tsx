'use client';

import { useEffect, useMemo, useState } from 'react';
import { useApiMutation, useApiQuery, useInvalidateQuery } from '@/lib/hooks/useApi';
import { toast } from '@/lib/feedback/toast';

export type AdvanceVoucherRow = {
  id: string;
  voucherNumber?: string | null;
  date: string;
  amount: number;
  unapplied: number;
  description?: string | null;
  currencyCode?: string | null;
  sourceLabel?: string | null;
};

type AvailableAdvances = {
  invoiceId: string;
  isPosted: boolean;
  remainingAmount: number;
  cashKind: 'RECEIPT' | 'PAYMENT';
  advances: AdvanceVoucherRow[];
};

type Props = {
  open: boolean;
  invoiceId: string | null;
  remaining: number;
  kind: 'RECEIPT' | 'PAYMENT';
  onClose: () => void;
  onLinked?: () => void;
};

function money(value: number) {
  return value.toLocaleString('ar-EG', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function asDate(iso: string) {
  try {
    return new Date(iso).toLocaleDateString('ar-EG');
  } catch {
    return iso;
  }
}

export function LinkAdvancePaymentModal({
  open,
  invoiceId,
  remaining,
  kind,
  onClose,
  onLinked,
}: Props) {
  const invalidate = useInvalidateQuery();
  const [selected, setSelected] = useState<Record<string, string>>({});
  const [error, setError] = useState('');

  const { data, isLoading } = useApiQuery<AvailableAdvances>(
    ['invoice-available-advances', invoiceId],
    invoiceId ? `/invoices/${invoiceId}/available-advances` : '',
    undefined,
    { enabled: open && Boolean(invoiceId) }
  );
  const payload = data?.data;
  const rows = payload?.advances ?? [];
  const invoiceRemaining = Number(payload?.remainingAmount ?? remaining);
  const isReceipt = (payload?.cashKind ?? kind) === 'RECEIPT';

  useEffect(() => {
    if (!open) {
      setSelected({});
      setError('');
    }
  }, [open]);

  const allocations = useMemo(
    () =>
      Object.entries(selected)
        .map(([cashTransactionId, raw]) => ({
          cashTransactionId,
          amount: Number(raw),
        }))
        .filter((row) => Number.isFinite(row.amount) && row.amount > 0),
    [selected]
  );
  const selectedTotal = allocations.reduce((sum, row) => sum + row.amount, 0);

  const linkMutation = useApiMutation<unknown, { allocations: typeof allocations }>(
    invoiceId ? `/invoices/${invoiceId}/link-advances` : '/invoices',
    'POST',
    {
      showSuccessToast: false,
      onSuccess: () => {
        toast.success(isReceipt ? 'تم ربط التحصيل بالفاتورة' : 'تم ربط السداد بالفاتورة');
        invalidate(['invoices']);
        invalidate(['invoice', invoiceId]);
        invalidate(['invoice-settlements', invoiceId]);
        invalidate(['invoice-available-advances', invoiceId]);
        onLinked?.();
        onClose();
      },
      onError: (err) => {
        setError(err.message || 'تعذر ربط الدفعة المقدمة');
      },
    }
  );

  if (!open) return null;

  const title = isReceipt ? 'ربط دفعة مقدمة — تحصيل' : 'ربط دفعة مقدمة — سداد';
  const emptyLabel = isReceipt
    ? 'لا توجد عمليات تحصيل غير موزّعة على هذا العميل'
    : 'لا توجد عمليات سداد غير موزّعة على هذا المورد';

  const toggle = (row: AdvanceVoucherRow) => {
    setSelected((prev) => {
      if (prev[row.id] != null) {
        const next = { ...prev };
        delete next[row.id];
        return next;
      }
      const suggested = Math.min(row.unapplied, Math.max(invoiceRemaining - selectedTotal, 0) || row.unapplied);
      return { ...prev, [row.id]: String(suggested > 0 ? suggested : row.unapplied) };
    });
    setError('');
  };

  const submit = () => {
    if (!invoiceId) {
      setError('احفظ الفاتورة أولاً');
      return;
    }
    if (allocations.length === 0) {
      setError(isReceipt ? 'اختر عملية تحصيل واحدة على الأقل' : 'اختر عملية سداد واحدة على الأقل');
      return;
    }
    if (selectedTotal > invoiceRemaining + 0.0001) {
      setError('مجموع الربط أكبر من المتبقي على الفاتورة');
      return;
    }
    for (const row of allocations) {
      const voucher = rows.find((item) => item.id === row.cashTransactionId);
      if (voucher && row.amount > voucher.unapplied + 0.0001) {
        setError('المبلغ أكبر من المتبقي على الدفعة');
        return;
      }
    }
    setError('');
    linkMutation.mutate({ allocations });
  };

  return (
    <div
      className="fixed inset-0 z-[10050] flex items-center justify-center bg-black/40 p-4"
      style={{ direction: 'rtl' }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="link-advance-title"
    >
      <div className="flex max-h-[90vh] w-full max-w-2xl flex-col rounded-2xl border border-[#E6F0F7] bg-white shadow-2xl">
        <div className="border-b border-[#E6F0F7] px-6 py-4">
          <h2 id="link-advance-title" className="text-lg font-bold text-[#0A3D5E]">
            {title}
          </h2>
          <p className="mt-1 text-sm text-slate-600">
            المتبقي على الفاتورة:{' '}
            <strong>{money(invoiceRemaining)} ج.م</strong>
            {' — '}اختَر عملية {isReceipt ? 'تحصيل' : 'سداد'} على نفس الطرف.
          </p>
        </div>

        <div className="min-h-0 flex-1 overflow-auto px-6 py-4">
          {isLoading ? (
            <p className="py-8 text-center text-sm text-slate-500">جاري تحميل الدفعات…</p>
          ) : rows.length === 0 ? (
            <p className="py-8 text-center text-sm text-slate-500">{emptyLabel}</p>
          ) : (
            <table className="w-full text-right text-sm">
              <thead>
                <tr className="border-b border-[#E6F0F7] text-xs text-[#094C6B]">
                  <th className="py-2 font-semibold">اختيار</th>
                  <th className="py-2 font-semibold">رقم العملية</th>
                  <th className="py-2 font-semibold">التاريخ</th>
                  <th className="py-2 font-semibold">المصدر</th>
                  <th className="py-2 font-semibold">المتبقي</th>
                  <th className="py-2 font-semibold">مبلغ الربط</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => {
                  const checked = selected[row.id] != null;
                  return (
                    <tr key={row.id} className="border-b border-slate-100">
                      <td className="py-2">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggle(row)}
                          aria-label={row.voucherNumber || row.id}
                        />
                      </td>
                      <td className="py-2 font-medium text-slate-800">
                        {row.voucherNumber || '—'}
                        {row.description ? (
                          <p className="text-[11px] font-normal text-slate-500">{row.description}</p>
                        ) : null}
                      </td>
                      <td className="py-2 text-slate-600">{asDate(row.date)}</td>
                      <td className="py-2 text-slate-600">{row.sourceLabel || '—'}</td>
                      <td className="py-2 font-semibold">{money(row.unapplied)}</td>
                      <td className="py-2">
                        <input
                          type="number"
                          min={0.01}
                          step="0.01"
                          max={row.unapplied}
                          disabled={!checked}
                          className="w-28 rounded-lg border border-gray-300 p-1.5 text-sm disabled:bg-slate-50"
                          value={selected[row.id] ?? ''}
                          onChange={(e) =>
                            setSelected((prev) => ({ ...prev, [row.id]: e.target.value }))
                          }
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        <div className="border-t border-[#E6F0F7] px-6 py-4">
          <p className="text-xs text-slate-500">
            مجموع الربط: <strong>{money(selectedTotal)} ج.م</strong>
            {' — '}سيبقى على الفاتورة:{' '}
            <strong>{money(Math.max(invoiceRemaining - selectedTotal, 0))} ج.م</strong>
          </p>
          {error ? <p className="mt-2 text-sm text-red-600">{error}</p> : null}
          <div className="mt-4 flex justify-end gap-2">
            <button
              type="button"
              className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
              onClick={onClose}
              disabled={linkMutation.isPending}
            >
              إلغاء
            </button>
            <button
              type="button"
              className="rounded-lg bg-[#0E78AA] px-4 py-2 text-sm font-semibold text-white hover:bg-[#094C6B] disabled:opacity-60"
              onClick={submit}
              disabled={linkMutation.isPending || rows.length === 0}
            >
              {linkMutation.isPending ? 'جاري الربط…' : 'ربط الدفعة'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
