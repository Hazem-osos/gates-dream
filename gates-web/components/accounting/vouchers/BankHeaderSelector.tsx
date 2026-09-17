'use client';

import { erpInputErrorClass, erpLabelClass } from '@/components/erp/erpUiTokens';
import { BankSelect } from '@/app/components/form/BankSelect';
import type { BankAccountOption } from '@/lib/hooks/useMasterDataQueries';

export type { BankAccountOption };

type Props = {
  banks: BankAccountOption[];
  value: string;
  onChange: (bankAccountId: string) => void;
  disabled?: boolean;
  error?: boolean;
  errorMessage?: string;
  baseCurrency?: string;
  displayBalance?: number;
  tourId?: string;
};

export function BankHeaderSelector({
  banks,
  value,
  onChange,
  disabled,
  error,
  errorMessage,
  baseCurrency = 'EGP',
  displayBalance,
  tourId = 'bank-debit-fund',
}: Props) {
  const selected = banks.find((b) => b.id === value);
  const balance = Number(displayBalance ?? selected?.balance ?? 0);

  return (
    <div className="flex flex-wrap items-end gap-3" data-tour-id={tourId}>
      <div className="w-full max-w-[var(--erp-field-max,32rem)] min-w-0 space-y-1">
        <label className={erpLabelClass}>البنك / الحساب البنكي</label>
        <BankSelect
          value={value}
          onChange={onChange}
          disabled={disabled}
          banks={banks.length ? banks : undefined}
          placeholder="اختر الحساب البنكي..."
          emptyLabel="اختر الحساب البنكي..."
          className={error ? erpInputErrorClass : undefined}
        />
        {error && errorMessage ? <p className="text-xs text-rose-600">{errorMessage}</p> : null}
      </div>
      <div className="flex flex-col justify-end pb-0.5">
        <div className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs">
          <span className="block text-[11px] text-slate-500">رصيد البنك الحالي</span>
          <span className="font-mono font-bold text-blue-700">
            {balance.toLocaleString('ar-EG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}{' '}
            {baseCurrency === 'EGP' ? 'ج.م' : baseCurrency}
          </span>
        </div>
      </div>
    </div>
  );
}
