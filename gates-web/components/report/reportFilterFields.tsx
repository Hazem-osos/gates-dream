'use client';

import type { ReactNode } from 'react';
import { HijriCaption } from '@/components/ui/DatePickerWithHijri';
import ErrorToast from '@/components/ErrorToast';
import { compactControlClass, compactLabelClass } from '@/components/ui/forms/formTokens';
import { PageHeader, type PageHeaderProps } from '@/components/ui';
import { PartySelect } from '@/app/components/form/PartySelect';
import { WarehouseSelect } from '@/app/components/form/WarehouseSelect';
import { ItemSelect } from '@/app/components/form/ItemSelect';
import { CostCenterSelect } from '@/app/components/form/CostCenterSelect';
import { AccountSelect } from '@/app/components/form/AccountSelect';
import { SearchableCombobox } from '@/app/components/form/SearchableCombobox';
import { useApiQuery } from '@/lib/hooks/useApi';

export function ReportFilterPageShell({
  children,
  error,
  onClearError,
  title,
  description,
  breadcrumbs,
  headerActions,
}: {
  children: ReactNode;
  error?: string;
  onClearError?: () => void;
  /** App-standard page header (blue underline) — same as inventory cards & operations */
  title?: string;
  description?: string;
  breadcrumbs?: PageHeaderProps['breadcrumbs'];
  headerActions?: ReactNode;
}) {
  return (
    <div className="bg-slate-50/80 dark:bg-slate-950 py-4 md:py-6 px-4 md:px-6" dir="rtl">
      {error ? <ErrorToast message={error} onClose={() => onClearError?.()} /> : null}
      <div className="w-full max-w-none">
        {title ? (
          <PageHeader
            title={title}
            description={description}
            breadcrumbs={breadcrumbs}
            actions={headerActions}
            className="mb-4 md:mb-5"
          />
        ) : null}
        {children}
      </div>
    </div>
  );
}

export function ReportFilterSection({
  title,
  children,
  className = '',
}: {
  title?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={`col-span-full ${className}`}>
      {title ? (
        <h3 className="text-sm font-semibold text-[#0A3D5E] dark:text-sky-200 mb-2 text-right">
          {title}
        </h3>
      ) : null}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {children}
      </div>
    </div>
  );
}

export const reportFilterSpanFull = 'col-span-full';

/** Applied on UnifiedReportFilterCard grid — normalizes legacy markup to reportFilterInputClass / labels. */
export const reportFilterUnifiedFieldsClass = 'report-filter-unified-fields';

/** Multi-column layout for legacy filter markup (space-y-* sections). */
export const reportFilterLegacyGridClass =
  'col-span-full grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-4 gap-y-3 [&_.space-y-4]:contents [&_.space-y-6]:contents [&_.space-y-4>h3]:col-span-full [&_.space-y-6>h3]:col-span-full [&_.space-y-4>div]:min-w-0 [&_.space-y-6>div]:min-w-0 [&_div.grid>div]:contents [&_div.grid>div>h3]:col-span-full [&_select]:w-full [&_input:not([type=checkbox])]:w-full';

export function ReportFilterLegacyGrid({ children }: { children: ReactNode }) {
  return <div className={reportFilterLegacyGridClass}>{children}</div>;
}

export function ReportFilterDateRange({
  fromLabel = 'من تاريخ',
  toLabel = 'إلى تاريخ',
  fromValue,
  toValue,
  onFromChange,
  onToChange,
  showHijri = true,
}: {
  fromLabel?: string;
  toLabel?: string;
  fromValue: string;
  toValue: string;
  onFromChange: (v: string) => void;
  onToChange: (v: string) => void;
  showHijri?: boolean;
}) {
  return (
    <>
      <ReportFilterDate
        label={fromLabel}
        value={fromValue}
        onChange={onFromChange}
        showHijri={showHijri}
      />
      <ReportFilterDate label={toLabel} value={toValue} onChange={onToChange} showHijri={showHijri} />
    </>
  );
}

/** Compact report-filter chrome — same h-9 tokens as card forms. */
export const reportFilterInputClass = compactControlClass;

export const reportFilterLabelClass = `${compactLabelClass} text-right`;

/** Padding when a leading (RTL: left) search/decoration icon sits inside the field. */
export const reportFilterInputIconPadClass = 'pl-10';

const searchIconPath =
  'M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z';

/** Magnifying glass on the left — correct for RTL text starting on the right. */
export function ReportFilterSearchIcon({ className = '' }: { className?: string }) {
  return (
    <svg
      className={`absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none ${className}`}
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
      aria-hidden
    >
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={searchIconPath} />
    </svg>
  );
}

export function ReportFilterField({
  label,
  children,
  className,
}: {
  label: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      <span className={reportFilterLabelClass}>{label}</span>
      {children}
    </div>
  );
}

export type ReportSelectOption = { value: string; label: string };

export function ReportFilterSelect({
  label,
  value,
  onChange,
  options,
  placeholder = '—',
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: ReportSelectOption[];
  placeholder?: string;
}) {
  return (
    <ReportFilterField label={label}>
      <select
        className={reportFilterInputClass}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        <option value="">{placeholder}</option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </ReportFilterField>
  );
}

export function ReportFilterDate({
  label,
  value,
  onChange,
  showHijri = true,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  showHijri?: boolean;
}) {
  return (
    <ReportFilterField label={label}>
      <div data-hijri-unified="1">
        <input
          type="date"
          className={`${reportFilterInputClass} w-full min-w-[9rem]`}
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
        {showHijri ? <HijriCaption value={value} /> : null}
      </div>
    </ReportFilterField>
  );
}

export function ReportFilterCheckbox({
  id,
  label,
  checked,
  onChange,
}: {
  id: string;
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label htmlFor={id} className="inline-flex items-center gap-2 cursor-pointer text-sm text-slate-700 dark:text-slate-300">
      <input
        id={id}
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="w-4 h-4 rounded border-slate-300 text-sky-600 focus:ring-sky-500"
      />
      {label}
    </label>
  );
}

export function ReportFilterOptionsRow({ children }: { children: ReactNode }) {
  return (
    <div className="col-span-full flex flex-wrap items-center gap-6 mt-2 pt-2 border-t border-slate-100 dark:border-slate-800">
      {children}
    </div>
  );
}

export function ReportFilterPartyGroupSelect({
  kind,
  value,
  onChange,
  emptyLabel,
}: {
  kind: 'CUSTOMER' | 'SUPPLIER';
  value: string;
  onChange: (id: string) => void;
  emptyLabel?: string;
}) {
  const isCustomer = kind === 'CUSTOMER';
  const { data, isLoading } = useApiQuery<
    { id: string; code?: string | null; arabicName?: string | null; name?: string | null }[]
  >(
    [isCustomer ? 'report-filter-customer-groups' : 'report-filter-supplier-groups'],
    isCustomer ? '/accounting/customer-categories' : '/accounting/supplier-categories',
    { limit: 500, isActive: true }
  );
  const options = (data?.data ?? []).map((g) => {
    const name = g.arabicName || g.name || '';
    return { value: g.id, label: g.code ? `${g.code} — ${name}` : name };
  });
  return (
    <ReportFilterCombobox
      label={isCustomer ? 'مجموعة العميل' : 'مجموعة المورد'}
      value={value}
      onChange={onChange}
      options={options}
      placeholder={emptyLabel ?? (isCustomer ? 'كل مجموعات العملاء' : 'كل مجموعات الموردين')}
      loading={isLoading}
    />
  );
}

export function ReportFilterPartySelect({
  label,
  kind,
  value,
  onChange,
  emptyLabel,
}: {
  label: string;
  kind: 'CUSTOMER' | 'SUPPLIER';
  value: string;
  onChange: (id: string) => void;
  emptyLabel?: string;
}) {
  return (
    <ReportFilterField label={label}>
      <PartySelect
        kind={kind}
        value={value}
        onChange={onChange}
        className={reportFilterInputClass}
        emptyLabel={emptyLabel}
        enableQuickCreate={false}
      />
    </ReportFilterField>
  );
}

export function ReportFilterWarehouseSelect({
  label,
  value,
  onChange,
  emptyLabel = 'كل المخازن',
}: {
  label: string;
  value: string;
  onChange: (id: string) => void;
  emptyLabel?: string;
}) {
  return (
    <ReportFilterField label={label}>
      <WarehouseSelect
        value={value}
        onChange={onChange}
        className={reportFilterInputClass}
        emptyLabel={emptyLabel}
      />
    </ReportFilterField>
  );
}

export function ReportFilterItemSelect({
  label,
  value,
  onChange,
  emptyLabel = 'كل الأصناف',
}: {
  label: string;
  value: string;
  onChange: (id: string) => void;
  emptyLabel?: string;
}) {
  return (
    <ReportFilterField label={label}>
      <ItemSelect
        value={value}
        onChange={onChange}
        className={reportFilterInputClass}
        emptyLabel={emptyLabel}
        enableQuickCreate={false}
        portaled
      />
    </ReportFilterField>
  );
}

export function ReportFilterCostCenterSelect({
  label,
  value,
  onChange,
  emptyLabel = 'كل مراكز التكلفة',
}: {
  label: string;
  value: string;
  onChange: (id: string) => void;
  emptyLabel?: string;
}) {
  return (
    <ReportFilterField label={label}>
      <CostCenterSelect
        value={value}
        onChange={onChange}
        className={reportFilterInputClass}
        emptyLabel={emptyLabel}
      />
    </ReportFilterField>
  );
}

export function ReportFilterAccountSelect({
  label,
  value,
  onChange,
  emptyLabel = 'كل الحسابات',
  placeholder = 'ابحث عن حساب…',
}: {
  label: string;
  value: string;
  onChange: (id: string) => void;
  emptyLabel?: string;
  placeholder?: string;
}) {
  return (
    <ReportFilterField label={label}>
      <AccountSelect
        value={value}
        onChange={onChange}
        className={reportFilterInputClass}
        emptyLabel={emptyLabel}
        placeholder={placeholder}
        enableQuickCreate
      />
    </ReportFilterField>
  );
}

type NamedCodeOption = { id: string; code?: string | null; arabicName?: string | null; name?: string | null };

function namedCodeLabel(row: NamedCodeOption) {
  const name = row.arabicName || row.name || '';
  return row.code ? `${row.code} — ${name}` : name;
}

export function ReportFilterBranchSelect({
  label = 'الفرع',
  value,
  onChange,
  emptyLabel = 'كل الفروع',
}: {
  label?: string;
  value: string;
  onChange: (id: string) => void;
  emptyLabel?: string;
}) {
  const { data } = useApiQuery<NamedCodeOption[]>(
    ['report-filter-branches'],
    '/company/branches',
    { limit: 1000, isActive: true }
  );
  const options = (data?.data ?? []).map((b) => ({
    value: b.id,
    label: namedCodeLabel(b),
  }));
  return (
    <ReportFilterSelect
      label={label}
      value={value}
      onChange={onChange}
      options={options}
      placeholder={emptyLabel}
    />
  );
}

export function ReportFilterCurrencySelect({
  label = 'العملة',
  value,
  onChange,
  emptyLabel = 'كل العملات',
}: {
  label?: string;
  value: string;
  onChange: (id: string) => void;
  emptyLabel?: string;
}) {
  const { data } = useApiQuery<NamedCodeOption[]>(
    ['report-filter-currencies'],
    '/accounting/currencies',
    { limit: 100, isActive: true }
  );
  const options = (data?.data ?? []).map((c) => ({
    value: c.id,
    label: c.code ? `${c.arabicName || c.name || ''} (${c.code})` : namedCodeLabel(c),
  }));
  return (
    <ReportFilterSelect
      label={label}
      value={value}
      onChange={onChange}
      options={options}
      placeholder={emptyLabel}
    />
  );
}

export function ReportFilterDelegateSelect({
  label = 'المندوب',
  value,
  onChange,
  emptyLabel = 'كل المندوبين',
}: {
  label?: string;
  value: string;
  onChange: (id: string) => void;
  emptyLabel?: string;
}) {
  const { data, isLoading } = useApiQuery<NamedCodeOption[]>(
    ['report-filter-delegates'],
    '/accounting/delegates',
    { limit: 1000, isActive: true }
  );
  const options = (data?.data ?? []).map((d) => ({
    value: d.id,
    label: namedCodeLabel(d),
  }));
  return (
    <ReportFilterCombobox
      label={label}
      value={value}
      onChange={onChange}
      options={options}
      placeholder={emptyLabel}
      loading={isLoading}
    />
  );
}

export function ReportFilterItemGroupSelect({
  label = 'المجموعة',
  value,
  onChange,
  emptyLabel = 'كل المجموعات',
}: {
  label?: string;
  value: string;
  onChange: (id: string) => void;
  emptyLabel?: string;
}) {
  const { data, isLoading } = useApiQuery<NamedCodeOption[]>(
    ['report-filter-item-groups'],
    '/inventory/item-categories',
    { limit: 1000, isActive: true }
  );
  const options = (data?.data ?? []).map((g) => ({
    value: g.id,
    label: namedCodeLabel(g),
  }));
  return (
    <ReportFilterCombobox
      label={label}
      value={value}
      onChange={onChange}
      options={options}
      placeholder={emptyLabel}
      loading={isLoading}
    />
  );
}

export function ReportFilterCombobox({
  label,
  value,
  onChange,
  options,
  placeholder = 'بحث…',
  loading,
}: {
  label: string;
  value: string;
  onChange: (id: string) => void;
  options: ReportSelectOption[];
  placeholder?: string;
  loading?: boolean;
}) {
  const comboOptions = options
    .filter((o) => o.value !== '')
    .map((o) => ({
      value: o.value,
      label: o.label,
      searchText: o.label,
    }));

  return (
    <ReportFilterField label={label}>
      <SearchableCombobox
        value={value}
        onChange={onChange}
        options={comboOptions}
        placeholder={placeholder}
        loading={loading}
        className={reportFilterInputClass}
      />
    </ReportFilterField>
  );
}
