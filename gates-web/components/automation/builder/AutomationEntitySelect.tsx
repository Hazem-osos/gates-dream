'use client';

import { useMemo, useState } from 'react';
import { SearchableCombobox } from '@/app/components/form/SearchableCombobox';
import { CustomerSelect, SupplierSelect } from '@/app/components/form/PartySelect';
import { ItemSelect } from '@/app/components/form/ItemSelect';
import { WarehouseSelect } from '@/app/components/form/WarehouseSelect';
import { useApiQuery } from '@/lib/hooks/useApi';
import { useI18n } from '@/lib/i18n';
import type { AutomationEntityKind } from '@/lib/automation/metadata';

type NamedRow = {
  id: string;
  arabicName?: string | null;
  englishName?: string | null;
  name?: string | null;
  code?: string | null;
  legacyCode?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  username?: string | null;
  email?: string | null;
  invoiceNumber?: string | null;
  orderNumber?: string | null;
};

type Props = {
  kind: AutomationEntityKind | undefined;
  listPath?: string;
  listQuery?: Record<string, string>;
  value: string;
  onChange: (id: string) => void;
  disabled?: boolean;
};

function displayName(row: NamedRow, locale: string): string {
  if (row.invoiceNumber) return row.invoiceNumber;
  if (row.orderNumber) return row.orderNumber;
  const person = [row.firstName, row.lastName].filter(Boolean).join(' ').trim();
  if (person) return row.username ? `${person} (${row.username})` : person;
  if (row.username) return row.username;
  if (locale === 'en') return row.englishName || row.arabicName || row.name || row.email || row.code || row.id;
  return row.arabicName || row.name || row.englishName || row.email || row.code || row.id;
}

function LookupSelect({
  path,
  value,
  onChange,
  disabled,
  searchParam,
  extraQuery,
}: {
  path: string;
  value: string;
  onChange: (id: string) => void;
  disabled?: boolean;
  searchParam?: boolean;
  extraQuery?: Record<string, string>;
}) {
  const { t, locale } = useI18n();
  const [search, setSearch] = useState('');
  const query = useApiQuery<NamedRow[]>(
    ['automation-entity', path, searchParam ? search : ''],
    path,
    searchParam ? { ...extraQuery, search, limit: 50 } : { ...extraQuery, limit: 200 },
    { staleTime: 60_000 }
  );
  const detail = useApiQuery<NamedRow>(
    ['automation-entity-one', path, value],
    `${path}/${value}`,
    undefined,
    { enabled: Boolean(value) && path === '/users', staleTime: 60_000 }
  );

  const options = useMemo(() => {
    const rows = query.data?.data ?? [];
    const mapped = rows.map((row) => ({
      value: row.id,
      label: displayName(row, locale),
      searchText: `${row.arabicName ?? ''} ${row.englishName ?? ''} ${row.code ?? ''} ${row.email ?? ''} ${row.username ?? ''} ${row.invoiceNumber ?? ''} ${row.orderNumber ?? ''}`,
    }));
    const pinned = detail.data?.data;
    if (pinned?.id && !mapped.some((option) => option.value === pinned.id)) {
      mapped.unshift({
        value: pinned.id,
        label: displayName(pinned, locale),
        searchText: displayName(pinned, locale),
      });
    }
    return mapped;
  }, [query.data?.data, detail.data?.data, locale]);

  const selectedLabel = options.find((option) => option.value === value)?.label;

  return (
    <div className="flex items-center gap-2">
      <div className="min-w-0 flex-1">
        <SearchableCombobox
          value={value}
          onChange={onChange}
          options={options}
          disabled={disabled}
          loading={query.isLoading}
          error={query.isError}
          placeholder={t('automation.selectEntity')}
          emptyMessage={query.isError ? t('automation.entityLoadError') : t('automation.noResults')}
          valueLabel={selectedLabel}
          onQueryChange={searchParam ? setSearch : undefined}
          portaled
          menuPlacement="auto"
        />
      </div>
      {value && !disabled ? (
        <button
          type="button"
          onClick={() => onChange('')}
          className="shrink-0 text-xs font-semibold text-foreground-muted hover:text-danger"
        >
          {t('automation.clear')}
        </button>
      ) : null}
    </div>
  );
}

export function AutomationEntitySelect({ kind, listPath, listQuery, value, onChange, disabled }: Props) {
  const { t } = useI18n();
  const placeholder = t('automation.selectEntity');

  if (!kind) {
    return <p className="text-xs text-danger">{t('automation.entityUnsupported')}</p>;
  }

  const clear = value && !disabled ? (
    <button
      type="button"
      onClick={() => onChange('')}
      className="shrink-0 text-xs font-semibold text-foreground-muted hover:text-danger"
    >
      {t('automation.clear')}
    </button>
  ) : null;

  if (kind === 'customer' || kind === 'supplier' || kind === 'item' || kind === 'warehouse') {
    const control =
      kind === 'customer' ? (
        <CustomerSelect value={value} onChange={onChange} disabled={disabled} enableQuickCreate={false} emptyLabel={placeholder} />
      ) : kind === 'supplier' ? (
        <SupplierSelect value={value} onChange={onChange} disabled={disabled} enableQuickCreate={false} emptyLabel={placeholder} />
      ) : kind === 'item' ? (
        <ItemSelect value={value} onChange={onChange} disabled={disabled} enableQuickCreate={false} emptyLabel={placeholder} />
      ) : (
        <WarehouseSelect value={value} onChange={onChange} disabled={disabled} enableQuickCreate={false} emptyLabel={placeholder} />
      );
    return (
      <div className="flex items-center gap-2">
        <div className="min-w-0 flex-1">{control}</div>
        {clear}
      </div>
    );
  }

  if (kind === 'customerCategory') {
    return (
      <LookupSelect
        path={listPath || '/accounting/customer-categories'}
        value={value}
        onChange={onChange}
        disabled={disabled}
        extraQuery={listQuery}
      />
    );
  }

  if (kind === 'user') {
    return (
      <LookupSelect path={listPath || '/users'} value={value} onChange={onChange} disabled={disabled} searchParam extraQuery={listQuery} />
    );
  }

  if (kind === 'purchaseInvoice') {
    return (
      <LookupSelect
        path={listPath || '/invoices'}
        value={value}
        onChange={onChange}
        disabled={disabled}
        searchParam
        extraQuery={listQuery ?? { invoiceKind: 'PURCHASE' }}
      />
    );
  }

  if (kind === 'salesInvoice') {
    return (
      <LookupSelect
        path={listPath || '/invoices'}
        value={value}
        onChange={onChange}
        disabled={disabled}
        searchParam
        extraQuery={listQuery ?? { invoiceKind: 'SALE' }}
      />
    );
  }

  if (kind === 'purchaseOrder') {
    return (
      <LookupSelect
        path={listPath || '/inventory/purchase-orders'}
        value={value}
        onChange={onChange}
        disabled={disabled}
        extraQuery={listQuery}
      />
    );
  }

  if (listPath) {
    return <LookupSelect path={listPath} value={value} onChange={onChange} disabled={disabled} searchParam extraQuery={listQuery} />;
  }

  return <p className="text-xs text-danger">{t('automation.entityUnsupported')}</p>;
}
