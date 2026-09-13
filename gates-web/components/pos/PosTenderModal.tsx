'use client';

import { useMemo } from 'react';
import { formatMoneyAr } from '@/lib/formatMoney';
import { compactControlClass } from '@/components/ui';

export type PosTenderMethod = 'نقدى' | 'فيزا' | 'آجل';

const KEYPAD = ['7', '8', '9', '4', '5', '6', '1', '2', '3', '00', '0', '.'];

export function PosTenderModal({
  open,
  net,
  method,
  paid,
  onMethodChange,
  onPaidChange,
  onClose,
  onConfirm,
  busy,
}: {
  open: boolean;
  net: number;
  method: PosTenderMethod;
  paid: string;
  onMethodChange: (method: PosTenderMethod) => void;
  onPaidChange: (paid: string) => void;
  onClose: () => void;
  onConfirm: () => void;
  busy?: boolean;
}) {
  const paidNumber = Number(paid) || 0;
  const change = useMemo(() => Math.max(0, paidNumber - net), [paidNumber, net]);
  const remaining = useMemo(() => Math.max(0, net - paidNumber), [paidNumber, net]);

  if (!open) return null;

  const appendDigit = (key: string) => {
    if (key === '.' && paid.includes('.')) return;
    onPaidChange(paid === '0' && key !== '.' ? key : `${paid}${key}`);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" dir="rtl">
      <div className="w-full max-w-lg rounded-xl border border-slate-200/80 bg-white p-5 shadow-2xl dark:border-slate-800 dark:bg-slate-900">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold text-slate-900">نافذة السداد السريع</h2>
          <button type="button" onClick={onClose} className="text-sm text-slate-500 hover:text-slate-800">
            إغلاق
          </button>
        </div>

        <div className="mb-4 grid grid-cols-3 gap-2">
          {(['نقدى', 'فيزا', 'آجل'] as PosTenderMethod[]).map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => onMethodChange(tab)}
              className={`h-10 rounded-lg text-sm font-semibold transition-colors ${
                method === tab
                  ? 'bg-[#0E79AA] text-white'
                  : 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        <div className="mb-4 rounded-xl border border-slate-200 bg-slate-50/70 p-4">
          <p className="text-xs text-slate-500">صافي المستحق</p>
          <p className="text-2xl font-bold tabular-nums text-slate-900">{formatMoneyAr(net)}</p>
        </div>

        {method !== 'آجل' ? (
          <>
            <label className="mb-1 block text-xs font-semibold text-slate-600">المبلغ المدفوع</label>
            <input
              className={`${compactControlClass} mb-3 h-10 text-base`}
              value={paid}
              onChange={(e) => onPaidChange(e.target.value)}
              inputMode="decimal"
            />
            <div className="mb-4 grid grid-cols-3 gap-2">
              {KEYPAD.map((key) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => appendDigit(key)}
                  className="h-10 rounded-lg border border-slate-200 bg-white text-sm font-semibold text-slate-800 hover:bg-slate-50"
                >
                  {key}
                </button>
              ))}
              <button
                type="button"
                onClick={() => onPaidChange('')}
                className="col-span-3 h-9 rounded-lg bg-slate-100 text-xs font-semibold text-slate-600"
              >
                مسح
              </button>
            </div>
            {change > 0 ? (
              <p className="mb-4 text-lg font-bold text-emerald-600">
                المتبقي للعميل: {formatMoneyAr(change)}
              </p>
            ) : remaining > 0 ? (
              <p className="mb-4 text-sm font-semibold text-amber-700">
                المتبقي على العميل: {formatMoneyAr(remaining)}
              </p>
            ) : (
              <p className="mb-4 text-sm font-semibold text-emerald-700">تم تغطية المبلغ بالكامل</p>
            )}
          </>
        ) : (
          <p className="mb-4 text-sm text-slate-600">سيتم تسجيل العملية آجلاً على حساب العميل المحدد.</p>
        )}

        <div className="flex gap-2">
          <button
            type="button"
            onClick={onConfirm}
            disabled={busy}
            className="h-10 flex-1 rounded-lg bg-[#0E79AA] text-sm font-semibold text-white hover:bg-[#0B6188] disabled:opacity-60"
          >
            {busy ? 'جاري التأكيد…' : 'تأكيد السداد'}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="h-10 rounded-lg border border-slate-200 px-4 text-sm font-semibold text-slate-600"
          >
            إلغاء
          </button>
        </div>
      </div>
    </div>
  );
}
