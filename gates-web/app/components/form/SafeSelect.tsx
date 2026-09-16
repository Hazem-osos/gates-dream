'use client';

import { memo, useMemo, useState } from 'react';
import { SearchableCombobox } from '@/app/components/form/SearchableCombobox';
import { compactControlClass } from '@/components/ui/forms/formTokens';
import { useSafesQuery, type SafeOption } from '@/lib/hooks/useMasterDataQueries';
import { QuickCreateSafeModal } from '@/app/components/form/QuickCreateSafeModal';

function safeLabel(row: { code?: string | null; arabicName?: string; englishName?: string; isDefault?: boolean }) {
  const name = row.arabicName || row.englishName || '';
  const base = row.code ? `[${row.code}] ${name}` : name;
  return row.isDefault ? `${base} (رئيسية)` : base;
}

function SafeSelectInner({
  value,
  onChange,
  disabled,
  className,
  placeholder = 'اختر الخزنة',
  allowEmpty = true,
  emptyLabel = 'اختر الخزنة',
  safes,
  enableQuickCreate = true,
}: {
  value: string;
  onChange: (safeId: string) => void;
  disabled?: boolean;
  className?: string;
  placeholder?: string;
  allowEmpty?: boolean;
  emptyLabel?: string;
  safes?: SafeOption[];
  enableQuickCreate?: boolean;
}) {
  const { data, isLoading, isError } = useSafesQuery({ enabled: !safes });
  const rows = safes ?? data?.data ?? [];
  const [quickOpen, setQuickOpen] = useState(false);
  const [quickName, setQuickName] = useState('');
  const [pinned, setPinned] = useState<SafeOption | null>(null);

  const options = useMemo(() => {
    const merged = pinned && !rows.some((row) => row.id === pinned.id) ? [pinned, ...rows] : rows;
    const list = merged.map((row) => ({
      value: row.id,
      label: safeLabel(row),
      searchText: `${row.code ?? ''} ${row.arabicName ?? ''} ${row.englishName ?? ''}`,
    }));
    if (allowEmpty) {
      return [{ value: '', label: emptyLabel || placeholder, searchText: '' }, ...list];
    }
    return list;
  }, [allowEmpty, emptyLabel, pinned, placeholder, rows]);

  const valueLabel = useMemo(() => {
    if (!value) return undefined;
    const hit = rows.find((row) => row.id === value) ?? (pinned?.id === value ? pinned : null);
    return hit ? safeLabel(hit) : undefined;
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
        loading={!safes && isLoading}
        error={!safes && isError}
        emptyMessage="لا توجد خزائن"
        valueLabel={valueLabel}
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
        <QuickCreateSafeModal
          open={quickOpen}
          initialName={quickName}
          onClose={() => setQuickOpen(false)}
          onCreated={(safe) => {
            setPinned({
              id: safe.id,
              arabicName: safe.arabicName,
              code: safe.code,
            });
            onChange(safe.id);
          }}
        />
      ) : null}
    </>
  );
}

export const SafeSelect = memo(SafeSelectInner);
