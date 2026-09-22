'use client';

import { memo, useMemo, useState, type SelectHTMLAttributes } from 'react';
import {
  useWarehousesQuery,
  isHeaderWarehouse,
  isOperationsWarehouse,
  type WarehouseOption,
} from '@/lib/hooks/useMasterDataQueries';
import { useApiQuery } from '@/lib/hooks/useApi';
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
  leafOnly = true,
  headerOnly = false,
  nativeSelectProps,
  enableQuickCreate = true,
  excludeIds,
}: {
  value: string;
  onChange: (id: string) => void;
  disabled?: boolean;
  className?: string;
  allowEmpty?: boolean;
  emptyLabel?: string;
  leafOnly?: boolean;
  headerOnly?: boolean;
  nativeSelectProps?: SelectHTMLAttributes<HTMLSelectElement> &
    Record<`data-${string}`, string | undefined>;
  enableQuickCreate?: boolean;
  excludeIds?: string[];
}) {
  const { data, isLoading, isError } = useWarehousesQuery(1000, {
    leafOnly: headerOnly ? false : leafOnly,
    headerOnly,
  });
  const rows = data?.data ?? [];
  const [pinned, setPinned] = useState<WarehouseOption | null>(null);
  const missingSelected = Boolean(value && !rows.some((row) => row.id === value) && pinned?.id !== value);
  const { data: selectedRes } = useApiQuery<WarehouseOption>(
    ['warehouses', 'pin', value || 'none'],
    value ? `/inventory/warehouses/${value}` : '/inventory/warehouses',
    undefined,
    { enabled: missingSelected }
  );
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
    const extra = [pinned, selectedRes?.data].filter((row): row is WarehouseOption => Boolean(row?.id));
    const seen = new Set(rows.map((row) => row.id));
    const extras = extra.filter((row) => !seen.has(row.id));
    return extras.length ? [...extras, ...rows] : rows;
  }, [pinned, rows, selectedRes?.data]);

  const options = useMemo(() => {
    const blocked = new Set(excludeIds ?? []);
    const list = merged
      .filter((w) => {
        if (blocked.has(w.id)) return false;
        if (w.id === value) return true;
        if (headerOnly) return isHeaderWarehouse(w);
        if (leafOnly) return isOperationsWarehouse(w);
        return true;
      })
      .map((w) => ({
        value: w.id,
        label: warehouseLabel(w),
        searchText: `${w.code ?? ''} ${w.arabicName} ${w.englishName ?? ''}`,
      }));
    if (allowEmpty) {
      return [{ value: '', label: emptyLabel, searchText: '' }, ...list];
    }
    return list;
  }, [allowEmpty, emptyLabel, excludeIds, headerOnly, leafOnly, merged, value]);

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
