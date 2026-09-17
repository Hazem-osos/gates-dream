'use client';

import { memo, useCallback, useEffect, useMemo, useState } from 'react';
import {
  useAccountsQuery,
  formatAccountLabel,
  isPostableLeafAccount,
  ACCOUNT_PICKER_PAGE_SIZE,
  PICKER_UNLIMITED_VISIBLE,
  type AccountOption,
} from '@/lib/hooks/useMasterDataQueries';
import { SearchableCombobox } from '@/app/components/form/SearchableCombobox';
import { compactControlClass } from '@/components/ui/forms/formTokens';
import { QuickCreateAccountModal } from '@/app/components/form/QuickCreateAccountModal';
import { useApiQuery } from '@/lib/hooks/useApi';

const selectCls = compactControlClass;

function AccountSelectInner({
  value,
  onChange,
  disabled,
  className,
  placeholder = 'اختر الحساب',
  allowEmpty = true,
  emptyLabel = '—',
  leafOnly = true,
  headerOnly = false,
  excludeIds,
  statementType,
  bankOnly = false,
  selectedAccount,
  nativeSelectProps,
  enableQuickCreate = true,
}: {
  value: string;
  onChange: (accountId: string) => void;
  disabled?: boolean;
  className?: string;
  placeholder?: string;
  allowEmpty?: boolean;
  emptyLabel?: string;
  leafOnly?: boolean;
  headerOnly?: boolean;
  excludeIds?: string[];
  statementType?: 'BALANCE_SHEET' | 'INCOME_STATEMENT';
  bankOnly?: boolean;
  selectedAccount?: { id: string; code: string; arabicName: string } | null;
  nativeSelectProps?: React.SelectHTMLAttributes<HTMLSelectElement> &
    Record<`data-${string}`, string | undefined>;
  enableQuickCreate?: boolean;
}) {
  const [search, setSearch] = useState('');
  const [quickOpen, setQuickOpen] = useState(false);
  const [quickName, setQuickName] = useState('');
  const [pinnedAccount, setPinnedAccount] = useState<{
    id: string;
    code: string;
    arabicName: string;
  } | null>(null);
  const { data, isLoading, isError } = useAccountsQuery(search, ACCOUNT_PICKER_PAGE_SIZE, {
    leafOnly: headerOnly ? false : leafOnly,
    headerOnly,
    statementType,
  });
  const { data: banksRes } = useApiQuery<
    Array<{ glAccountId?: string | null; glAccount?: { id?: string | null } | null }>
  >(['bank-accounts', 'picker'], '/accounting/bank-accounts', { isActive: true }, { enabled: bankOnly });
  const bankGlIds = useMemo(() => {
    const ids = new Set<string>();
    for (const bank of banksRes?.data ?? []) {
      const id = bank.glAccountId || bank.glAccount?.id;
      if (id) ids.add(id);
    }
    return ids;
  }, [banksRes?.data]);
  const accounts = data?.data ?? [];

  const options = useMemo(() => {
    const merged =
      pinnedAccount && !accounts.some((a) => a.id === pinnedAccount.id)
        ? [pinnedAccount as AccountOption, ...accounts]
        : accounts;
    const blocked = new Set(excludeIds ?? []);
    const list = merged
      .filter((a: AccountOption) => {
        if (blocked.has(a.id)) return false;
        if (bankOnly && !bankGlIds.has(a.id)) return false;
        if (headerOnly) return a.accountKind !== 'POSTING';
        if (leafOnly) return isPostableLeafAccount(a);
        return true;
      })
      .map((a: AccountOption) => ({
        value: a.id,
        label: formatAccountLabel(a),
        searchText: `${a.code} ${a.arabicName} ${a.englishName ?? ''}`,
      }));
    if (allowEmpty) {
      return [{ value: '', label: emptyLabel || placeholder, searchText: '' }, ...list];
    }
    return list;
  }, [accounts, allowEmpty, bankGlIds, bankOnly, emptyLabel, excludeIds, headerOnly, leafOnly, placeholder, pinnedAccount]);

  const valueLabel = useMemo(() => {
    if (!value) return undefined;
    const hit = accounts.find((a) => a.id === value);
    if (hit) return formatAccountLabel(hit);
    if (pinnedAccount && pinnedAccount.id === value) {
      return formatAccountLabel(pinnedAccount);
    }
    if (selectedAccount && selectedAccount.id === value) {
      return formatAccountLabel(selectedAccount);
    }
    return undefined;
  }, [accounts, pinnedAccount, selectedAccount, value]);

  const handleQueryChange = useCallback((q: string) => {
    setSearch(q);
  }, []);

  useEffect(() => {
    if (!value) setSearch('');
  }, [value]);

  const openQuickCreate = (query?: string) => {
    setQuickName(query?.trim() || '');
    setQuickOpen(true);
  };

  return (
    <>
      <SearchableCombobox
        value={value}
        onChange={onChange}
        options={options}
        disabled={disabled}
        className={className ?? selectCls}
        placeholder={placeholder}
        loading={isLoading}
        error={isError}
        emptyMessage={isError ? 'تعذر تحميل الحسابات' : 'لا توجد نتائج'}
        valueLabel={valueLabel}
        onQueryChange={handleQueryChange}
        maxVisible={PICKER_UNLIMITED_VISIBLE}
        portaled
        menuPlacement="auto"
        quickCreateLabel={enableQuickCreate && !bankOnly ? '+ إضافة سريع' : undefined}
        onQuickCreate={enableQuickCreate && !bankOnly ? (query) => openQuickCreate(query) : undefined}
        inputProps={{
          'aria-label': nativeSelectProps?.['aria-label'],
          title: nativeSelectProps?.title,
          name: nativeSelectProps?.name,
          required: nativeSelectProps?.required,
          'data-line-grid': nativeSelectProps?.['data-line-grid'],
          'data-line-index': nativeSelectProps?.['data-line-index'],
          'data-line-field': nativeSelectProps?.['data-line-field'],
          onKeyDown: nativeSelectProps?.onKeyDown as unknown as
            | React.KeyboardEventHandler<HTMLInputElement>
            | undefined,
        }}
      />
      {enableQuickCreate && quickOpen ? (
        <QuickCreateAccountModal
          open={quickOpen}
          initialName={quickName}
          onClose={() => setQuickOpen(false)}
          onCreated={(account) => {
            setPinnedAccount(account);
            onChange(account.id);
          }}
        />
      ) : null}
    </>
  );
}

export const AccountSelect = memo(AccountSelectInner);

export function AccountCombobox(props: Parameters<typeof AccountSelect>[0]) {
  return <AccountSelect {...props} />;
}
