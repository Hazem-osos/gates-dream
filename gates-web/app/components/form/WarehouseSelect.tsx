'use client';

import { memo, useMemo, useState, type SelectHTMLAttributes } from 'react';
import { useWarehousesQuery, type WarehouseOption } from '@/lib/hooks/useMasterDataQueries';
import { SearchableCombobox } from '@/app/components/form/SearchableCombobox';
import { compactControlClass } from '@/components/ui/forms/formTokens';
import { useOpenQuickCreateTab } from '@/lib/quick-create/useQuickCreateTab';

const selectCls = compactControlClass;

function warehouseLabel(w: { code?: string | null; arabicName: string }) {
  return w.code ? `[${w.code}] ${w.arabicName}` : w.arabicName;
}

function WarehouseSelectInner({
  value,
  onChange,
  disabled,
  className,
  allowEmpty = true,
  emptyLabel = 'اختر المخزن',
  nativeSelectProps,
  enableQuickCreate = true,
}: {
  value: string;
  onChange: (id: string) => void;
  disabled?: boolean;
  className?: string;
  allowEmpty?: boolean;
  emptyLabel?: string;
  nativeSelectProps?: SelectHTMLAttributes<HTMLSelectElement> &
    Record<`data-${string}`, string | undefined>;
  enableQuickCreate?: boolean;
}) {
  const { data, isLoading, isError } = useWarehousesQuery();
  const rows = data?.data ?? [];
  const [pinned, setPinned] = useState<WarehouseOption | null>(null);
  const openQuickCreate = useOpenQuickCreateTab('warehouse', (entity) => {
    const row = {
      id: entity.id,
      arabicName: entity.arabicName || entity.label,
      code: entity.code ?? null,
    } as WarehouseOption;
    setPinned(row);
    onChange(row.id);
  });

  const merged = useMemo(() => {
    if (pinned && !rows.some((w) => w.id === pinned.id)) {
      return [pinned, ...rows];
    }
    return rows;
  }, [pinned, rows]);

  const options = useMemo(() => {
    const list = merged.map((w) => ({
      value: w.id,
      label: warehouseLabel(w),
      searchText: `${w.code ?? ''} ${w.arabicName} ${w.englishName ?? ''}`,
    }));
    if (allowEmpty) {
      return [{ value: '', label: emptyLabel, searchText: '' }, ...list];
    }
    return list;
  }, [allowEmpty, emptyLabel, merged]);

  const valueLabel = useMemo(() => {
    if (!value) return undefined;
    const hit = merged.find((w) => w.id === value);
    return hit ? warehouseLabel(hit) : undefined;
  }, [merged, value]);

  return (
    <>
      <SearchableCombobox
        value={value}
        onChange={onChange}
        options={options}
        disabled={disabled}
        className={className ?? selectCls}
        placeholder={emptyLabel}
        loading={isLoading}
        error={isError}
        emptyMessage={isError ? 'تعذر تحميل المخازن' : 'لا توجد نتائج'}
        valueLabel={valueLabel}
        portaled
        menuPlacement="auto"
        quickCreateLabel={enableQuickCreate ? '+ إضافة سريع' : undefined}
        onQuickCreate={enableQuickCreate ? (query) => openQuickCreate(query) : undefined}
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
    </>
  );
}

export const WarehouseSelect = memo(WarehouseSelectInner);
