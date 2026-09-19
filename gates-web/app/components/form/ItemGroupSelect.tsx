'use client';

import { memo, useMemo } from 'react';
import { SearchableCombobox } from '@/app/components/form/SearchableCombobox';
import { compactControlClass } from '@/components/ui/forms/formTokens';

export type ItemGroupOption = {
  id: string;
  arabicName: string;
  code?: string | null;
};

function groupLabel(row: ItemGroupOption) {
  return row.code ? `[${row.code}] ${row.arabicName}` : row.arabicName;
}

function ItemGroupSelectInner({
  value,
  onChange,
  groups,
  excludeIds,
  disabled,
  emptyLabel = 'مجموعة رئيسية (بدون أب)',
  labelFor,
}: {
  value: string;
  onChange: (id: string) => void;
  groups: ItemGroupOption[];
  excludeIds?: string[];
  disabled?: boolean;
  emptyLabel?: string;
  labelFor?: (row: ItemGroupOption) => string;
}) {
  const options = useMemo(() => {
    const blocked = new Set(excludeIds ?? []);
    const list = groups
      .filter((row) => !blocked.has(row.id))
      .map((row) => ({
        value: row.id,
        label: labelFor ? labelFor(row) : groupLabel(row),
        searchText: `${row.code ?? ''} ${row.arabicName}`,
      }));
    return [{ value: '', label: emptyLabel, searchText: '' }, ...list];
  }, [emptyLabel, excludeIds, groups, labelFor]);

  const valueLabel = useMemo(() => {
    if (!value) return undefined;
    const hit = groups.find((row) => row.id === value);
    return hit ? (labelFor ? labelFor(hit) : groupLabel(hit)) : undefined;
  }, [groups, labelFor, value]);

  return (
    <SearchableCombobox
      value={value}
      onChange={onChange}
      options={options}
      disabled={disabled}
      className={compactControlClass}
      placeholder={emptyLabel}
      valueLabel={valueLabel}
      emptyMessage="لا توجد مجموعات"
      portaled
      menuPlacement="auto"
    />
  );
}

export const ItemGroupSelect = memo(ItemGroupSelectInner);
