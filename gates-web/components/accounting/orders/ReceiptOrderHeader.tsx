'use client';

import { OrderStatusBadge, type OrderExecutionStatus } from '@/components/accounting/orders/OrderStatusBadge';
import { erpInputClass, erpInputErrorClass, erpLabelClass } from '@/components/erp/erpUiTokens';

export type ReceiptOrderSafeOption = {
  id: string;
  arabicName?: string;
  englishName?: string;
  code?: string | null;
  balance?: number | string;
};

type Props = {
  safes: ReceiptOrderSafeOption[];
  value: string;
  onChange: (safeId: string) => void;
  disabled?: boolean;
  error?: boolean;
  errorMessage?: string;
  executionStatus: OrderExecutionStatus;
  baseCurrency?: string;
};

export function ReceiptOrderHeader({
  safes,
  value,
  onChange,
  disabled,
  error,
  errorMessage,
  executionStatus,
  baseCurrency = 'EGP',
}: Props) {
  const selected = safes.find((s) => s.id === value);
  const balance = Number(selected?.balance ?? 0);

  return (
    <div className="flex flex-wrap items-end gap-3">
      <div className="w-72 space-y-1">
        <label className={erpLabelClass}>الخزينة</label>
        <select
          className={`${erpInputClass} ${error ? erpInputErrorClass : ''}`}
          disabled={disabled}
          value={value}
          onChange={(e) => onChange(e.target.value)}
        >
          <option value="">اختر الخزينة...</option>
          {safes.map((safe) => (
            <option key={safe.id} value={safe.id}>
              {safe.arabicName || safe.englishName || safe.id}
              {safe.code ? ` (${safe.code})` : ''}
            </option>
          ))}
        </select>
        {error && errorMessage ? <p className="text-xs text-rose-600">{errorMessage}</p> : null}
      </div>
      <OrderStatusBadge orderType="RECEIPT_ORDER" status={executionStatus} />
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
