'use client';

import { memo, useMemo, useState } from 'react';
import { SearchableCombobox } from '@/app/components/form/SearchableCombobox';
import { compactControlClass } from '@/components/ui/forms/formTokens';
import {
  PICKER_UNLIMITED_VISIBLE,
  useBankAccountsQuery,
  type BankAccountOption,
} from '@/lib/hooks/useMasterDataQueries';
import { QuickCreateBankAccountModal } from '@/app/components/form/QuickCreateBankAccountModal';

function bankLabel(row: BankAccountOption) {
  const institution = row.bank?.arabicName || row.bank?.englishName || '';
  const name = row.glAccount?.arabicName || row.arabicName || row.englishName || row.id;
  const code = row.glAccount?.code || row.glAccountCode || row.code;
  const account = row.accountNumber ? ` - ${row.accountNumber}` : '';
  const base = code ? `[${code}] ${name}${account}` : `${name}${account}`;
  return institution ? `${institution} — ${base}` : base;
}

function BankSelectInner({
  value,
  onChange,
  disabled,
  className,
  placeholder = 'اختر الحساب البنكي',
  allowEmpty = true,
  emptyLabel = 'اختر الحساب البنكي',
  banks,
  enableQuickCreate = true,
}: {
  value: string;
  onChange: (bankAccountId: string) => void;
  disabled?: boolean;
  className?: string;
  placeholder?: string;
  allowEmpty?: boolean;
  emptyLabel?: string;
  banks?: BankAccountOption[];
  enableQuickCreate?: boolean;
}) {
  const { data, isLoading, isError } = useBankAccountsQuery({ enabled: !banks });
  const rows = banks ?? data?.data ?? [];
  const [quickOpen, setQuickOpen] = useState(false);
  const [quickName, setQuickName] = useState('');
  const [pinned, setPinned] = useState<BankAccountOption | null>(null);

  const options = useMemo(() => {
    const merged = pinned && !rows.some((row) => row.id === pinned.id) ? [pinned, ...rows] : rows;
    const list = merged.map((row) => ({
      value: row.id,
      label: bankLabel(row),
      searchText: `${row.bank?.arabicName ?? ''} ${row.bank?.englishName ?? ''} ${row.glAccount?.code ?? ''} ${row.glAccountCode ?? ''} ${row.code ?? ''} ${row.glAccount?.arabicName ?? ''} ${row.arabicName ?? ''} ${row.englishName ?? ''} ${row.accountNumber ?? ''}`,
    }));
    if (allowEmpty) {
      return [{ value: '', label: emptyLabel || placeholder, searchText: '' }, ...list];
    }
    return list;
  }, [allowEmpty, emptyLabel, pinned, placeholder, rows]);

  const valueLabel = useMemo(() => {
    if (!value) return undefined;
    const hit = rows.find((row) => row.id === value) ?? (pinned?.id === value ? pinned : null);
    return hit ? bankLabel(hit) : undefined;
  }, [pinned, rows, value]);

  return (
    <>
      <SearchableCombobox
        value={value}
        onChange={onChange}
        options={options}
        disabled={disabled}
        className={className ?? compactControlClass}
        placeholder={placeholder}
        loading={!banks && isLoading}
        error={!banks && isError}
        emptyMessage="لا توجد حسابات بنكية"
        valueLabel={valueLabel}
        maxVisible={PICKER_UNLIMITED_VISIBLE}
        portaled
        menuPlacement="auto"
        quickCreateLabel={enableQuickCreate ? '+ إضافة سريع' : undefined}
        onQuickCreate={
          enableQuickCreate
            ? (query) => {
                setQuickName(query?.trim() || '');
                setQuickOpen(true);
              }
            : undefined
        }
      />
      {enableQuickCreate && quickOpen ? (
        <QuickCreateBankAccountModal
          open={quickOpen}
          initialName={quickName}
          onClose={() => setQuickOpen(false)}
          onCreated={(bank) => {
            setPinned({
              id: bank.id,
              arabicName: bank.arabicName,
              code: bank.code,
            });
            onChange(bank.id);
          }}
        />
      ) : null}
    </>
  );
}

export const BankSelect = memo(BankSelectInner);
