'use client';

import { OrderStatusBadge, type OrderExecutionStatus } from '@/components/accounting/orders/OrderStatusBadge';
import { erpInputErrorClass, erpLabelClass } from '@/components/erp/erpUiTokens';
import { SafeSelect } from '@/app/components/form/SafeSelect';

export type PaymentOrderSafeOption = {
  id: string;
  arabicName?: string;
  englishName?: string;
  code?: string | null;
  balance?: number | string;
};

type Props = {
  safes: PaymentOrderSafeOption[];
  value: string;
  onChange: (safeId: string) => void;
  disabled?: boolean;
  error?: boolean;
  errorMessage?: string;
  executionStatus: OrderExecutionStatus;
  baseCurrency?: string;
  displayBalance?: number;
};

export function PaymentOrderHeader({
  safes,
  value,
  onChange,
  disabled,
  error,
  errorMessage,
  executionStatus,
  baseCurrency = 'EGP',
  displayBalance,
}: Props) {
  const selected = safes.find((s) => s.id === value);
  const balance = Number(displayBalance ?? selected?.balance ?? 0);

  return (
    <div className="flex flex-wrap items-end gap-3">
      <div className="w-full max-w-[var(--erp-field-max,32rem)] min-w-0 space-y-1">
        <label className={erpLabelClass}>الخزينة</label>
        <SafeSelect
          value={value}
          onChange={onChange}
          disabled={disabled}
          safes={safes}
          placeholder="اختر الخزينة..."
          emptyLabel="اختر الخزينة..."
          className={error ? erpInputErrorClass : undefined}
        />
        {error && errorMessage ? <p className="text-xs text-rose-600">{errorMessage}</p> : null}
      </div>
      <OrderStatusBadge orderType="PAYMENT_ORDER" status={executionStatus} />
      {selected ? (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs">
          <span className="block text-[11px] text-slate-500">رصيد الخزينة الحالي</span>
          <span className="font-mono font-bold text-emerald-700">
            {balance.toLocaleString('ar-EG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}{' '}
            {baseCurrency === 'EGP' ? 'ج.م' : baseCurrency}
          </span>
        </div>
      ) : null}
    </div>
  );
}
