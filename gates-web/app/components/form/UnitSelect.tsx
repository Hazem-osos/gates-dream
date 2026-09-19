'use client';

import { memo, useMemo } from 'react';
import { SearchableCombobox } from '@/app/components/form/SearchableCombobox';
import { compactControlClass } from '@/components/ui/forms/formTokens';
import { formatUnitOptionLabel } from '@/lib/inventory/unit-catalog';

export type UnitOption = {
  id: string;
  arabicName: string;
  code?: string | null;
  englishName?: string | null;
};

function UnitSelectInner({
  value,
  onChange,
  units,
  disabled,
  placeholder = 'اختر الوحدة',
  excludeIds,
}: {
  value: string;
  onChange: (id: string) => void;
  units: UnitOption[];
  disabled?: boolean;
  placeholder?: string;
  excludeIds?: string[];
}) {
  const excluded = useMemo(() => new Set((excludeIds ?? []).filter((id) => id && id !== value)), [
    excludeIds,
    value,
  ]);

  const options = useMemo(() => {
    const list = units
      .filter((unit) => !excluded.has(unit.id))
      .map((unit) => ({
        value: unit.id,
        label: formatUnitOptionLabel(unit),
        searchText: `${unit.code ?? ''} ${unit.arabicName} ${unit.englishName ?? ''}`,
      }));
    return [{ value: '', label: placeholder, searchText: '' }, ...list];
  }, [excluded, placeholder, units]);

  const valueLabel = useMemo(() => {
    if (!value) return undefined;
    const hit = units.find((unit) => unit.id === value);
    return hit ? formatUnitOptionLabel(hit) : undefined;
  }, [units, value]);

  return (
    <SearchableCombobox
      value={value}
      onChange={onChange}
      options={options}
      disabled={disabled}
      className={compactControlClass}
      placeholder={placeholder}
      valueLabel={valueLabel}
      emptyMessage="لا توجد وحدات — عرّف وحدة أولاً"
      portaled
      menuPlacement="auto"
    />
  );
}

export const UnitSelect = memo(UnitSelectInner);
