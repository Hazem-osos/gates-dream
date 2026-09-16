'use client';

import { erpInputErrorClass, erpLabelClass } from '@/components/erp/erpUiTokens';
import { SafeSelect } from '@/app/components/form/SafeSelect';

export type CashSafeOption = {
  id: string;
  arabicName?: string;
  englishName?: string;
  code?: string | null;
  balance?: number | string;
  isDefault?: boolean;
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
  const balance = Number(displayBalance ?? selected?.balance ?? 0);

  return (
    <div className="flex flex-wrap items-end gap-3" data-tour-id={tourId}>
      <div className="w-full max-w-[var(--erp-field-max,32rem)] min-w-0 space-y-1">
        <label className={erpLabelClass}>الخزنة</label>
        <SafeSelect
          value={value}
          onChange={onChange}
          disabled={disabled}
          safes={safes}
          placeholder="اختر الخزنة..."
          emptyLabel="اختر الخزنة..."
          className={error ? erpInputErrorClass : undefined}
        />
        {error && errorMessage ? <p className="text-xs text-rose-600">{errorMessage}</p> : null}
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
    </div>
  );
}
