'use client';

import { useEffect, useState } from 'react';
import { SafeSelect } from '@/app/components/form/SafeSelect';

export type InvoiceCollectPayload = {
  amount: number;
  safeId: string;
  date: string;
  description?: string;
};

type Safe = { id: string; arabicName?: string; code?: string | null; isDefault?: boolean };

type Props = {
  open: boolean;
  remaining: number;
  safes: Safe[];
  defaultSafeId?: string;
  pending?: boolean;
  mode?: 'collect' | 'pay';
  onClose: () => void;
  onConfirm: (payload: InvoiceCollectPayload) => void;
};

function todayIsoDate() {
  return new Date().toISOString().split('T')[0];
}

export function InvoiceCollectModal({
  open,
  remaining,
  safes,
  defaultSafeId,
  pending,
  mode = 'collect',
  onClose,
  onConfirm,
}: Props) {
  const pay = mode === 'pay';
  const copy = pay
    ? {
        title: 'سداد الفاتورة',
        leftover: 'بعد هذا السداد سيبقى على الفاتورة',
        amount: 'المبلغ المراد سداده',
        pending: 'جاري السداد…',
        partial: 'سداد جزئي',
        full: 'سداد كامل',
        amountError: 'أدخل مبلغ سداد أكبر من صفر',
      }
    : {
        title: 'تحصيل الفاتورة',
        leftover: 'بعد هذا التحصيل سيبقى على الفاتورة',
        amount: 'المبلغ المراد تحصيله',
        pending: 'جاري التحصيل…',
        partial: 'تحصيل جزئي',
        full: 'تحصيل كامل',
        amountError: 'أدخل مبلغ تحصيل أكبر من صفر',
      };
  const [amount, setAmount] = useState(String(remaining));
  const [safeId, setSafeId] = useState(defaultSafeId ?? '');
  const [date, setDate] = useState(todayIsoDate);
  const [description, setDescription] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open) return;
    setAmount(String(remaining));
    setSafeId(defaultSafeId ?? safes.find((safe) => safe.isDefault)?.id ?? safes[0]?.id ?? '');
    setDate(todayIsoDate());
    setDescription('');
    setError('');
  }, [open, remaining, defaultSafeId, safes]);

  if (!open) return null;

  const submit = () => {
    const parsed = Number(amount);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      setError(copy.amountError);
      return;
    }
    if (parsed > remaining + 0.0001) {
      setError('المبلغ أكبر من المتبقي على الفاتورة');
      return;
    }
    if (!safeId) {
      setError('اختر الخزينة');
      return;
    }
    setError('');
    onConfirm({
      amount: Math.round(parsed * 100) / 100,
      safeId,
      date: new Date(`${date}T12:00:00`).toISOString(),
      description: description.trim() || undefined,
    });
  };

  const leftover = Math.max(0, Math.round((remaining - (Number(amount) || 0)) * 100) / 100);

  return (
    <div
      className="fixed inset-0 z-[10050] flex items-center justify-center bg-black/40 p-4"
      style={{ direction: 'rtl' }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="invoice-collect-title"
    >
      <div className="w-full max-w-md rounded-2xl border border-[#E6F0F7] bg-white p-6 shadow-2xl">
        <h2 id="invoice-collect-title" className="mb-1 text-lg font-bold text-[#0A3D5E]">
          {copy.title}
        </h2>
        <p className="mb-4 text-sm text-slate-600">
          المتبقي:{' '}
          <strong>{remaining.toLocaleString('ar-EG', { minimumFractionDigits: 2 })} ج.م</strong>
          {' — '}يمكنك تحصيل المبلغ كاملاً أو جزء منه.
        </p>

        <div className="space-y-3">
          <label className="block">
            <span className="mb-1 block text-xs font-semibold text-[#094C6B]">{copy.amount}</span>
            <input
              type="number"
              min={0.01}
              step="0.01"
              max={remaining}
              className="w-full rounded-lg border border-gray-300 p-2 text-sm"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              autoFocus
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-semibold text-[#094C6B]">الخزينة</span>
            <SafeSelect
              value={safeId}
              onChange={setSafeId}
              safes={safes}
              placeholder="اختر الخزينة"
              emptyLabel="اختر الخزينة"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-semibold text-[#094C6B]">تاريخ التحصيل</span>
            <input
              type="date"
              className="w-full rounded-lg border border-gray-300 p-2 text-sm"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-semibold text-[#094C6B]">البيان (اختياري)</span>
            <input
              type="text"
              className="w-full rounded-lg border border-gray-300 p-2 text-sm"
              placeholder="تحصيل جزئي / دفعة"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </label>
        </div>

        <p className="mt-3 text-xs text-slate-500">
          {copy.leftover}:{' '}
          <strong>{leftover.toLocaleString('ar-EG', { minimumFractionDigits: 2 })} ج.م</strong>
        </p>
        {error ? <p className="mt-2 text-sm text-red-600">{error}</p> : null}

        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
            onClick={onClose}
            disabled={pending}
          >
            إلغاء
          </button>
          <button
            type="button"
            className="rounded-lg bg-[#0E78AA] px-4 py-2 text-sm font-semibold text-white hover:bg-[#094C6B] disabled:opacity-60"
            onClick={submit}
            disabled={pending}
          >
            {pending ? copy.pending : leftover > 0 ? copy.partial : copy.full}
          </button>
        </div>
      </div>
    </div>
  );
}
