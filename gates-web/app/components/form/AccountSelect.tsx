'use client';

import { memo, useCallback, useMemo, useState } from 'react';
import {
  useAccountsQuery,
  formatAccountLabel,
  isPostableLeafAccount,
  PICKER_PAGE_SIZE,
  type AccountOption,
} from '@/lib/hooks/useMasterDataQueries';
import { SearchableCombobox } from '@/app/components/form/SearchableCombobox';
import { lazyNamedModal } from '@/components/ui/lazyModal';
import { compactControlClass } from '@/components/ui/forms/formTokens';

const QuickCreateAccountModal = lazyNamedModal(
  () => import('@/app/components/form/QuickCreateAccountModal'),
  'QuickCreateAccountModal',
  'جاري تحميل إضافة حساب…'
);

const selectCls = compactControlClass;

function AccountSelectInner({
  value,
  onChange,
  disabled,
  className,
  placeholder = 'اختر الحساب',
  allowEmpty = true,
  emptyLabel = '—',
  leafOnly = false,
  statementType,
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
  statementType?: 'BALANCE_SHEET' | 'INCOME_STATEMENT';
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
  const { data, isLoading, isError } = useAccountsQuery(search, PICKER_PAGE_SIZE, {
    leafOnly,
    statementType,
  });
  const accounts = data?.data ?? [];

  const options = useMemo(() => {
    const merged =
      pinnedAccount && !accounts.some((a) => a.id === pinnedAccount.id)
        ? [pinnedAccount as AccountOption, ...accounts]
        : accounts;
    const list = merged
      .filter((a: AccountOption) => (leafOnly ? isPostableLeafAccount(a) : true))
      .map((a: AccountOption) => ({
        value: a.id,
        label: formatAccountLabel(a),
        searchText: `${a.code} ${a.arabicName} ${a.englishName ?? ''}`,
      }));
    if (allowEmpty) {
      return [{ value: '', label: emptyLabel || placeholder, searchText: '' }, ...list];
    }
    return list;
  }, [accounts, allowEmpty, emptyLabel, leafOnly, placeholder, pinnedAccount]);

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
        maxVisible={PICKER_PAGE_SIZE}
        portaled
        menuPlacement="auto"
        quickCreateLabel={enableQuickCreate ? '+ إضافة سريع' : undefined}
        onQuickCreate={
          enableQuickCreate
            ? (query) => {
                setQuickName(query);
                setQuickOpen(true);
              }
            : undefined
        }
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
          open
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
