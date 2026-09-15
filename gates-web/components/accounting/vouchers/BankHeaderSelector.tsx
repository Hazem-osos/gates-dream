'use client';

import { Plus } from 'lucide-react';
import { erpInputClass, erpInputErrorClass, erpLabelClass } from '@/components/erp/erpUiTokens';
import { useOpenQuickCreateTab } from '@/lib/quick-create/useQuickCreateTab';

export type BankAccountOption = {
  id: string;
  arabicName?: string;
  englishName?: string;
  code?: string | null;
  accountNumber?: string | null;
  balance?: number | string;
  glAccountCode?: string | null;
  glAccount?: { code?: string | null } | null;
  bank?: { arabicName?: string; englishName?: string; code?: string | null } | null;
};

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

function bankLabel(bank: BankAccountOption) {
  const institution = bank.bank?.arabicName || bank.bank?.englishName || '';
  const name = bank.arabicName || bank.englishName || bank.id;
  const account = bank.accountNumber ? ` - ${bank.accountNumber}` : '';
  return institution ? `${institution} — ${name}${account}` : `${name}${account}`;
}

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
  const openQuickCreate = useOpenQuickCreateTab('bank-account', (entity) => onChange(entity.id));

  return (
    <div className="flex flex-wrap items-end gap-3" data-tour-id={tourId}>
      <div className="min-w-[220px] flex-1 space-y-1">
        <label className={erpLabelClass}>البنك / الحساب البنكي</label>
        <div className="flex items-stretch gap-1">
          <select
            className={`${erpInputClass} ${error ? erpInputErrorClass : ''} min-w-0 flex-1`}
            disabled={disabled}
            value={value}
            onChange={(e) => onChange(e.target.value)}
          >
            <option value="">اختر الحساب البنكي...</option>
            {banks.map((bank) => (
              <option key={bank.id} value={bank.id}>
                {bankLabel(bank)}
              </option>
            ))}
          </select>
          {!disabled ? (
            <button
              type="button"
              title="إضافة حساب بنكي جديد"
              aria-label="إضافة حساب بنكي جديد"
              className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-[#D6EAF3] bg-[#F6FBFD] text-[#0E78AA] hover:bg-[#EEF7FB]"
              onClick={() => openQuickCreate()}
            >
              <Plus className="h-4 w-4" />
            </button>
          ) : null}
        </div>
        {error && errorMessage ? <p className="text-xs text-rose-600">{errorMessage}</p> : null}
      </div>
      <div className="w-28 space-y-1">
        <label className="mb-1.5 block text-xs font-medium text-slate-500">كود البنك</label>
        <input
          type="text"
          value={selected?.code || selected?.glAccountCode || selected?.glAccount?.code || ''}
          readOnly
          className="h-9 w-full rounded-md border border-[#D6EAF3] bg-[#F6FBFD] px-2 text-center font-mono text-xs text-[#094C6B]"
          placeholder="---"
        />
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
