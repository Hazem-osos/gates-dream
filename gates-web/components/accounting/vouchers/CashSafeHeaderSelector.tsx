'use client';

import { useState } from 'react';
import { Plus } from 'lucide-react';
import { erpInputClass, erpInputErrorClass, erpLabelClass } from '@/components/erp/erpUiTokens';
import { lazyNamedModal } from '@/components/ui/lazyModal';

const QuickCreateSafeModal = lazyNamedModal(
  () => import('@/app/components/form/QuickCreateSafeModal'),
  'QuickCreateSafeModal',
  'جاري تحميل إضافة خزنة…'
);

export type CashSafeOption = {
  id: string;
  arabicName?: string;
  englishName?: string;
  code?: string | null;
  balance?: number | string;
  glAccountCode?: string | null;
  glAccount?: { code?: string | null } | null;
};

type Props = {
  safes: CashSafeOption[];
  value: string;
  onChange: (safeId: string) => void;
  disabled?: boolean;
  error?: boolean;
  errorMessage?: string;
  baseCurrency?: string;
  displayBalance?: number;
  tourId?: string;
};

export function CashSafeHeaderSelector({
  safes,
  value,
  onChange,
  disabled,
  error,
  errorMessage,
  baseCurrency = 'EGP',
  displayBalance,
  tourId = 'payment-voucher-safe',
}: Props) {
  const selected = safes.find((s) => s.id === value);
  const safeCode = selected?.code || selected?.glAccountCode || selected?.glAccount?.code || '';
  const balance = Number(displayBalance ?? selected?.balance ?? 0);
  const [quickOpen, setQuickOpen] = useState(false);

  return (
    <div className="flex flex-wrap items-end gap-3" data-tour-id={tourId}>
      <div className="min-w-[220px] flex-1 space-y-1">
        <label className={erpLabelClass}>الخزنة</label>
        <div className="flex items-stretch gap-1">
          <select
            className={`${erpInputClass} ${error ? erpInputErrorClass : ''} min-w-0 flex-1`}
            disabled={disabled}
            value={value}
            onChange={(e) => onChange(e.target.value)}
          >
            <option value="">اختر الخزنة...</option>
            {safes.map((safe) => (
              <option key={safe.id} value={safe.id}>
                {safe.arabicName || safe.englishName || safe.id}
              </option>
            ))}
          </select>
          {!disabled ? (
            <button
              type="button"
              title="إضافة خزنة جديدة"
              aria-label="إضافة خزنة جديدة"
              className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-[#D6EAF3] bg-[#F6FBFD] text-[#0E78AA] hover:bg-[#EEF7FB]"
              onClick={() => setQuickOpen(true)}
            >
              <Plus className="h-4 w-4" />
            </button>
          ) : null}
        </div>
        {error && errorMessage ? <p className="text-xs text-rose-600">{errorMessage}</p> : null}
      </div>
      <div className="w-28 space-y-1">
        <label className="mb-1.5 block text-xs font-medium text-slate-500">كود الخزنة</label>
        <input
          type="text"
          value={safeCode}
          readOnly
          className="h-9 w-full rounded-md border border-[#D6EAF3] bg-[#F6FBFD] px-2 text-center font-mono text-xs text-[#094C6B]"
          placeholder="---"
        />
      </div>
      <div className="flex flex-col justify-end pb-0.5">
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs">
          <span className="block text-[11px] text-slate-500">رصيد الخزنة الحالي</span>
          <span className="font-mono font-bold text-emerald-700">
            {balance.toLocaleString('ar-EG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}{' '}
            {baseCurrency === 'EGP' ? 'ج.م' : baseCurrency}
          </span>
        </div>
      </div>
      {quickOpen ? (
        <QuickCreateSafeModal
          open
          currencyCode={baseCurrency}
          onClose={() => setQuickOpen(false)}
          onCreated={(safe) => onChange(safe.id)}
        />
      ) : null}
    </div>
  );
}
