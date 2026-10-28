'use client';

import { useBankAccountsQuery, useSafesQuery } from '@/lib/hooks/useMasterDataQueries';
import { compactControlClass } from '@/components/ui/forms/formTokens';

export type HrPaymentSource = { kind: 'safe' | 'bank'; id: string };

/** Pick the treasury source of an HR payout: one safe or one bank account. */
export function HrPaymentSourcePicker({
  value,
  onChange,
  disabled,
}: {
  value: HrPaymentSource;
  onChange: (next: HrPaymentSource) => void;
  disabled?: boolean;
}) {
  const safes = useSafesQuery({ enabled: value.kind === 'safe' });
  const banks = useBankAccountsQuery({ enabled: value.kind === 'bank' });
  const rows =
    value.kind === 'safe'
      ? (safes.data?.data ?? []).map((s) => ({ id: s.id, label: s.arabicName ?? s.code ?? s.id }))
      : (banks.data?.data ?? []).map((b) => ({
          id: b.id,
          label: [b.bank?.arabicName, b.arabicName, b.accountNumber].filter(Boolean).join(' — ') || b.id,
        }));

  const tab = (kind: HrPaymentSource['kind'], label: string) => (
    <button
      type="button"
      disabled={disabled}
      onClick={() => onChange({ kind, id: '' })}
      className={`rounded-lg border px-4 py-1.5 text-sm transition-colors ${
        value.kind === kind ? 'border-brand bg-brand text-white' : 'border-slate-200 bg-white text-slate-700'
      }`}
    >
      {label}
    </button>
  );

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        {tab('safe', 'خزينة')}
        {tab('bank', 'بنك')}
      </div>
      <select
        className={compactControlClass}
        value={value.id}
        disabled={disabled}
        onChange={(e) => onChange({ kind: value.kind, id: e.target.value })}
      >
        <option value="">{value.kind === 'safe' ? 'اختر الخزينة' : 'اختر الحساب البنكي'}</option>
        {rows.map((r) => (
          <option key={r.id} value={r.id}>
            {r.label}
          </option>
        ))}
      </select>
    </div>
  );
}

export function paymentSourceBody(source: HrPaymentSource) {
  return source.kind === 'safe'
    ? { safeId: source.id, bankAccountId: null }
    : { bankAccountId: source.id, safeId: null };
}
