'use client';

import { useCallback, useMemo, useState } from 'react';
import { SearchableCombobox } from '@/app/components/form/SearchableCombobox';
import { QuickCreateKindChooser } from '@/app/components/form/QuickCreateDialog';
import { lazyNamedModal } from '@/components/ui/lazyModal';
import {
  formatAccountLabel,
  isPostableLeafAccount,
  PICKER_PAGE_SIZE,
  useAccountsQuery,
  useCustomersQuery,
  useSuppliersQuery,
  type AccountOption,
  type PartyOption,
} from '@/lib/hooks/useMasterDataQueries';

const QuickCreateAccountModal = lazyNamedModal(
  () => import('@/app/components/form/QuickCreateAccountModal'),
  'QuickCreateAccountModal',
  'جاري تحميل إضافة حساب…'
);
const QuickCreatePartyModal = lazyNamedModal(
  () => import('@/app/components/form/QuickCreatePartyModal'),
  'QuickCreatePartyModal',
  'جاري تحميل إضافة طرف…'
);

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

function partyLabel(p: PartyOption) {
  return p.code ? `[${p.code}] ${p.arabicName}` : p.arabicName;
}

export function VoucherAccountCombobox({
  value,
  partyId,
  partyKind,
  valueLabel,
  disabled,
  className,
  inputProps,
  onInputKeyDown,
  onPick,
}: Props) {
  const [search, setSearch] = useState('');
  const [chooserOpen, setChooserOpen] = useState(false);
  const [createKind, setCreateKind] = useState<'ACCOUNT' | 'CUSTOMER' | 'SUPPLIER' | null>(null);
  const [quickName, setQuickName] = useState('');
  const [pinnedLabel, setPinnedLabel] = useState<string | undefined>(undefined);
  const accountsQ = useAccountsQuery(search, PICKER_PAGE_SIZE, { leafOnly: true });
  const customersQ = useCustomersQuery(PICKER_PAGE_SIZE, search, true);
  const suppliersQ = useSuppliersQuery(PICKER_PAGE_SIZE, search, true);

  const accounts = (accountsQ.data?.data ?? []).filter((a: AccountOption) =>
    isPostableLeafAccount(a)
  );
  const customers = useMemo(() => customersQ.data?.data ?? [], [customersQ.data?.data]);
  const suppliers = useMemo(() => suppliersQ.data?.data ?? [], [suppliersQ.data?.data]);

  const options = useMemo(() => {
    return [
      ...accounts.map((a) => ({
        value: `acct:${a.id}`,
        label: `حساب · ${formatAccountLabel(a)}`,
        searchText: `${a.code} ${a.arabicName} ${a.englishName ?? ''}`,
      })),
      ...customers.map((p) => ({
        value: `customer:${p.id}`,
        label: `عميل · ${partyLabel(p)}`,
        searchText: `${p.code ?? ''} ${p.arabicName} ${p.englishName ?? ''}`,
      })),
      ...suppliers.map((p) => ({
        value: `supplier:${p.id}`,
        label: `مورد · ${partyLabel(p)}`,
        searchText: `${p.code ?? ''} ${p.arabicName} ${p.englishName ?? ''}`,
      })),
    ];
  }, [accounts, customers, suppliers]);

  const selectedValue =
    partyKind === 'CUSTOMER' && partyId
      ? `customer:${partyId}`
      : partyKind === 'SUPPLIER' && partyId
        ? `supplier:${partyId}`
        : value
          ? `acct:${value}`
          : '';

  const handleChange = useCallback(
    (raw: string) => {
      if (!raw) {
        onPick({ kind: 'ACCOUNT', accountId: '' });
        return;
      }
      if (raw.startsWith('acct:')) {
        onPick({ kind: 'ACCOUNT', accountId: raw.slice(5) });
        return;
      }
      if (raw.startsWith('customer:')) {
        const partyId = raw.slice(9);
        const party = customers.find((p) => p.id === partyId);
        onPick({
          kind: 'CUSTOMER',
          partyId,
          accountId: party?.accountId || '',
        });
        return;
      }
      if (raw.startsWith('supplier:')) {
        const partyId = raw.slice(9);
        const party = suppliers.find((p) => p.id === partyId);
        onPick({
          kind: 'SUPPLIER',
          partyId,
          accountId: party?.accountId || '',
        });
      }
    },
    [customers, onPick, suppliers]
  );

  return (
    <>
      <SearchableCombobox
        value={selectedValue}
        onChange={handleChange}
        options={options}
        disabled={disabled}
        className={className}
        placeholder="الحساب / العميل / المورد"
        loading={accountsQ.isLoading || customersQ.isLoading || suppliersQ.isLoading}
        emptyMessage="لا توجد نتائج"
        valueLabel={pinnedLabel || valueLabel}
        onQueryChange={setSearch}
        maxVisible={PICKER_PAGE_SIZE}
        portaled
        menuPlacement="auto"
        inputProps={inputProps}
        onInputKeyDown={onInputKeyDown}
        quickCreateLabel="+ إضافة سريع"
        onQuickCreate={(query) => {
          setQuickName(query);
          setChooserOpen(true);
        }}
      />
      <QuickCreateKindChooser
        open={chooserOpen}
        title="إضافة جديد"
        options={[
          { id: 'ACCOUNT', label: 'حساب' },
          { id: 'CUSTOMER', label: 'عميل' },
          { id: 'SUPPLIER', label: 'مورد' },
        ]}
        onClose={() => setChooserOpen(false)}
        onPick={(id) => {
          setChooserOpen(false);
          setCreateKind(id as 'ACCOUNT' | 'CUSTOMER' | 'SUPPLIER');
        }}
      />
      {createKind === 'ACCOUNT' ? (
        <QuickCreateAccountModal
          open
          initialName={quickName}
          onClose={() => setCreateKind(null)}
          onCreated={(account) => {
            setPinnedLabel(`حساب · ${formatAccountLabel(account)}`);
            onPick({ kind: 'ACCOUNT', accountId: account.id });
          }}
        />
      ) : null}
      {createKind === 'CUSTOMER' || createKind === 'SUPPLIER' ? (
        <QuickCreatePartyModal
          open
          kind={createKind}
          initialName={quickName}
          onClose={() => setCreateKind(null)}
          onCreated={(party) => {
            const prefix = createKind === 'CUSTOMER' ? 'عميل' : 'مورد';
            setPinnedLabel(`${prefix} · ${partyLabel(party)}`);
            onPick({
              kind: createKind,
              partyId: party.id,
              accountId: party.accountId || '',
            });
          }}
        />
      ) : null}
    </>
  );
}
