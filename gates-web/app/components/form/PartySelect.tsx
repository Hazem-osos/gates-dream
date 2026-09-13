'use client';

import { memo, useCallback, useEffect, useMemo, useState, type ComponentType } from 'react';
import {
  useAccountsQuery,
  useCustomersQuery,
  useSuppliersQuery,
  formatAccountLabel,
  PICKER_PAGE_SIZE,
  type PartyOption,
} from '@/lib/hooks/useMasterDataQueries';
import { SearchableCombobox } from '@/app/components/form/SearchableCombobox';
import { PartyHoverCard } from '@/components/parties/PartyHoverCard';
import { CustomerBalanceInspector } from '@/components/parties/CustomerBalanceInspector';
import { lazyNamedModal } from '@/components/ui/lazyModal';
import { compactControlClass } from '@/components/ui/forms/formTokens';
import { apiClient } from '@/lib/api/client';
import { toast } from '@/lib/feedback/toast';

const QuickCreatePartyModal = lazyNamedModal(
  () => import('@/app/components/form/QuickCreatePartyModal'),
  'QuickCreatePartyModal',
  'جاري تحميل إضافة طرف…'
);

const selectCls = compactControlClass;

function partyLabel(p: { code?: string | null; arabicName: string }) {
  return p.code ? `[${p.code}] ${p.arabicName}` : p.arabicName;
}

type QuickCreateModalComponent = ComponentType<{
  open: boolean;
  initialName: string;
  onClose: () => void;
  onCreated: (party: PartyOption) => void;
}>;

function PartySelectInner({
  kind,
  value,
  onChange,
  disabled,
  className,
  allowEmpty = true,
  emptyLabel,
  enableQuickCreate = true,
  seedParty,
  quickCreateModal,
  includeAllAccounts = false,
}: {
  kind: 'CUSTOMER' | 'SUPPLIER';
  value: string;
  onChange: (id: string) => void;
  disabled?: boolean;
  className?: string;
  allowEmpty?: boolean;
  emptyLabel?: string;
  enableQuickCreate?: boolean;
  /** When true, search the full chart of accounts in addition to party cards. */
  includeAllAccounts?: boolean;
  /** When the party is not in the cached list yet (e.g. after loading an invoice). */
  seedParty?: PartyOption | null;
  /**
   * Sales Invoice Enterprise Redesign: lets a specific caller (the
   * sales-invoice header) swap in a richer quick-add modal without touching
   * every other `CustomerSelect`/`SupplierSelect` usage across the app
   * (reports, treasury vouchers, etc.), which intentionally keep the
   * simpler default `QuickCreatePartyModal`.
   */
  quickCreateModal?: QuickCreateModalComponent;
}) {
  const [search, setSearch] = useState('');
  const customerQ = useCustomersQuery(PICKER_PAGE_SIZE, search, kind === 'CUSTOMER');
  const supplierQ = useSuppliersQuery(PICKER_PAGE_SIZE, search, kind === 'SUPPLIER');
  const accountsQ = useAccountsQuery(search, PICKER_PAGE_SIZE, {
    leafOnly: true,
    enabled: includeAllAccounts,
  });
  const q = kind === 'CUSTOMER' ? customerQ : supplierQ;
  const rows = q.data?.data ?? [];
  const defaultEmpty = kind === 'CUSTOMER' ? 'اختر العميل' : 'اختر المورد';
  const [quickOpen, setQuickOpen] = useState(false);
  const [quickName, setQuickName] = useState('');
  /** Keeps label visible until React Query list includes the new party. */
  const [pinnedParty, setPinnedParty] = useState<PartyOption | null>(null);

  useEffect(() => {
    if (!value) {
      setPinnedParty(null);
      return;
    }
    if (seedParty?.id === value) {
      setPinnedParty(seedParty);
      return;
    }
    if (pinnedParty?.id === value && rows.some((p) => p.id === value)) {
      setPinnedParty(null);
    }
  }, [value, rows, pinnedParty?.id, seedParty]);

  const options = useMemo(() => {
    const mergedRows =
      pinnedParty && !rows.some((p) => p.id === pinnedParty.id)
        ? [pinnedParty, ...rows]
        : rows;
    const list = mergedRows.map((p) => ({
      value: p.id,
      label: partyLabel(p),
      searchText: `${p.code ?? ''} ${p.arabicName} ${p.englishName ?? ''}`,
    }));
    const accountOpts =
      includeAllAccounts
        ? (accountsQ.data?.data ?? []).map((a) => ({
            value: `acct:${a.id}`,
            label: `حساب · ${formatAccountLabel(a)}`,
            searchText: `${a.code} ${a.arabicName} ${a.englishName ?? ''}`,
          }))
        : [];
    const merged = [...list, ...accountOpts.filter((a) => !list.some((p) => p.value === a.value))];
    if (allowEmpty) {
      return [{ value: '', label: emptyLabel ?? defaultEmpty, searchText: '' }, ...merged];
    }
    return merged;
  }, [rows, pinnedParty, allowEmpty, emptyLabel, defaultEmpty, includeAllAccounts, accountsQ.data?.data]);

  const displayValueLabel = useMemo(() => {
    if (!value) return undefined;
    const fromList = rows.find((p) => p.id === value);
    if (fromList) return partyLabel(fromList);
    if (pinnedParty?.id === value) return partyLabel(pinnedParty);
    return options.find((o) => o.value === value)?.label;
  }, [value, rows, pinnedParty, options]);

  const handleQueryChange = useCallback((q: string) => {
    setSearch(q);
  }, []);

  const quickLabel = '+ إضافة سريع';
  const QuickCreateModal = quickCreateModal;

  return (
    <>
      <SearchableCombobox
        value={value}
        onChange={(id) => {
          if (!id.startsWith('acct:')) {
            onChange(id);
            return;
          }
          const accountId = id.slice(5);
          void apiClient
            .get<PartyOption[]>('/accounting/customers', { accountId, limit: 1, isActive: true })
            .then((res) => {
              const hit = res.data?.[0];
              if (hit?.id) {
                setPinnedParty(hit);
                onChange(hit.id);
                return;
              }
              toast.error('لا يوجد عميل مربوط بهذا الحساب. اربط الحساب من كارت العميل أولاً.');
            })
            .catch(() => {
              toast.error('تعذر البحث عن عميل مربوط بالحساب المحدد.');
            });
        }}
        options={options}
        disabled={disabled}
        className={className ?? selectCls}
        placeholder={emptyLabel ?? defaultEmpty}
        loading={q.isLoading}
        error={q.isError}
        emptyMessage={q.isError ? 'تعذر تحميل البيانات' : 'لا توجد نتائج'}
        quickCreateLabel={enableQuickCreate ? quickLabel : undefined}
        onQuickCreate={
          enableQuickCreate
            ? (query) => {
                setQuickName(query);
                setQuickOpen(true);
              }
            : undefined
        }
        valueLabel={displayValueLabel}
        onQueryChange={handleQueryChange}
        maxVisible={PICKER_PAGE_SIZE}
        clientSearchEntity={kind === 'CUSTOMER' ? 'customers' : 'suppliers'}
      />
      {enableQuickCreate && quickOpen ? (
        QuickCreateModal ? (
          <QuickCreateModal
            open
            initialName={quickName}
            onClose={() => setQuickOpen(false)}
            onCreated={(party) => {
              setPinnedParty(party);
              onChange(party.id);
            }}
          />
        ) : (
          <QuickCreatePartyModal
            open
            kind={kind}
            initialName={quickName}
            onClose={() => setQuickOpen(false)}
            onCreated={(party) => {
              setPinnedParty(party);
              onChange(party.id);
            }}
          />
        )
      ) : null}
      {value && enableQuickCreate ? (
        <div className="mt-1.5 text-[11px] text-slate-600">
          <PartyHoverCard
            partyId={value}
            partyType={kind}
            label={kind === 'CUSTOMER' ? 'ملخص العميل' : 'ملخص المورد'}
          >
            {options.find((o) => o.value === value)?.label ?? 'عرض الملخص المالي'}
          </PartyHoverCard>
          {kind === 'CUSTOMER' ? (
            <CustomerBalanceInspector
              customerId={value}
              customerName={options.find((o) => o.value === value)?.label}
            />
          ) : null}
        </div>
      ) : null}
    </>
  );
}

export const PartySelect = memo(PartySelectInner);

export function CustomerSelect(
  props: Omit<Parameters<typeof PartySelect>[0], 'kind'>
) {
  return <PartySelect kind="CUSTOMER" {...props} />;
}

export function SupplierSelect(
  props: Omit<Parameters<typeof PartySelect>[0], 'kind'>
) {
  return <PartySelect kind="SUPPLIER" {...props} />;
}
