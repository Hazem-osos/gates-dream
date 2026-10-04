'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { SearchableCombobox } from '@/app/components/form/SearchableCombobox';
import {
  formatAccountLabel,
  isPostableLeafAccount,
  ACCOUNT_PICKER_PAGE_SIZE,
  PICKER_UNLIMITED_VISIBLE,
  useAccountsQuery,
  type AccountOption,
} from '@/lib/hooks/useMasterDataQueries';
import { QuickCreateAccountModal } from '@/app/components/form/QuickCreateAccountModal';

export type VoucherAccountPick =
  | { kind: 'ACCOUNT'; accountId: string }
  | { kind: 'CUSTOMER'; partyId: string; accountId: string }
  | { kind: 'SUPPLIER'; partyId: string; accountId: string };

type Props = {
  value: string;
  partyId?: string;
  partyKind?: 'CUSTOMER' | 'SUPPLIER';
  valueLabel?: string;
  disabled?: boolean;
  className?: string;
  inputProps?: React.InputHTMLAttributes<HTMLInputElement> &
    Record<`data-${string}`, string | undefined>;
  onInputKeyDown?: (e: React.KeyboardEvent<HTMLInputElement>) => void;
  onPick: (pick: VoucherAccountPick) => void;
};

/**
 * Chart-of-accounts picker for journal and voucher lines.
 * A customer or supplier personal account appears once, under its account code and name.
 */
export function VoucherAccountCombobox({
  value,
  partyId,
  valueLabel,
  disabled,
  className,
  inputProps,
  onInputKeyDown,
  onPick,
}: Props) {
  const [search, setSearch] = useState('');
  const [quickOpen, setQuickOpen] = useState(false);
  const [quickName, setQuickName] = useState('');
  const [pinnedAccount, setPinnedAccount] = useState<AccountOption | null>(null);
  const [pinnedLabel, setPinnedLabel] = useState<string | undefined>(undefined);
  const accountsQ = useAccountsQuery(search, ACCOUNT_PICKER_PAGE_SIZE, { leafOnly: true });

  const accounts = useMemo(() => {
    const rows = (accountsQ.data?.data ?? []).filter((a: AccountOption) =>
      isPostableLeafAccount(a)
    );
    if (pinnedAccount && !rows.some((a) => a.id === pinnedAccount.id)) {
      return [pinnedAccount, ...rows];
    }
    return rows;
  }, [accountsQ.data?.data, pinnedAccount]);

  const options = useMemo(
    () =>
      accounts.map((a) => ({
        value: `acct:${a.id}`,
        label: formatAccountLabel(a),
        searchText: `${a.code} ${a.arabicName} ${a.englishName ?? ''}`,
      })),
    [accounts]
  );

  const selectedValue = value ? `acct:${value}` : '';

  useEffect(() => {
    if (!value && !partyId) {
      setSearch('');
      setPinnedLabel(undefined);
    }
  }, [value, partyId]);

  const handleChange = useCallback(
    (raw: string) => {
      if (!raw) {
        onPick({ kind: 'ACCOUNT', accountId: '' });
        return;
      }
      if (raw.startsWith('acct:')) {
        onPick({ kind: 'ACCOUNT', accountId: raw.slice(5) });
      }
    },
    [onPick]
  );

  return (
    <>
      <SearchableCombobox
        value={selectedValue}
        onChange={handleChange}
        options={options}
        disabled={disabled}
        className={className}
        placeholder="اختر الحساب"
        loading={accountsQ.isLoading}
        emptyMessage="لا توجد نتائج"
        valueLabel={pinnedLabel || valueLabel}
        onQueryChange={setSearch}
        maxVisible={PICKER_UNLIMITED_VISIBLE}
        portaled
        menuPlacement="auto"
        inputProps={inputProps}
        onInputKeyDown={onInputKeyDown}
        quickCreateLabel="+ إضافة سريع"
        onQuickCreate={(query) => {
          setQuickName(query?.trim() || '');
          setQuickOpen(true);
        }}
      />
      {quickOpen ? (
        <QuickCreateAccountModal
          open={quickOpen}
          initialName={quickName}
          onClose={() => setQuickOpen(false)}
          onCreated={(account) => {
            setPinnedAccount({
              id: account.id,
              code: account.code,
              arabicName: account.arabicName,
              accountKind: 'POSTING',
            });
            setPinnedLabel(formatAccountLabel(account));
            onPick({ kind: 'ACCOUNT', accountId: account.id });
          }}
        />
      ) : null}
    </>
  );
}
