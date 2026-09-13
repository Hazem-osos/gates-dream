'use client';

import { useMemo } from 'react';
import { useItemsQuery, type ItemOption } from '@/lib/hooks/useMasterDataQueries';
import { useApiQuery } from '@/lib/hooks/useApi';
import {
  defaultUnitIdForItem,
  formatUnitLabel,
  itemUnitRowsToLinks,
  unitsForItem,
} from '@/lib/inventory/item-units';
import { compactControlClass } from '@/components/ui/forms/formTokens';

const selectCls = compactControlClass;

type ItemUnitRow = {
  unitId: string;
  isBaseUnit?: boolean;
  isFactorFixed?: boolean | null;
  conversionFactor?: number | string | null;
  unit?: { id: string; code?: string | null; arabicName?: string; englishName?: string | null };
};

export function ItemUnitSelect({
  itemId,
  value,
  onChange,
  disabled,
  className,
  nativeSelectProps,
}: {
  itemId: string;
  value: string;
  onChange: (unitId: string) => void;
  disabled?: boolean;
  className?: string;
  nativeSelectProps?: React.SelectHTMLAttributes<HTMLSelectElement>;
}) {
  const { data, isLoading } = useItemsQuery();
  const items = data?.data ?? [];

  const item = useMemo(
    () => items.find((i: ItemOption) => i.id === itemId),
    [items, itemId]
  );
  const cachedLinks = useMemo(() => unitsForItem(item), [item]);

  const needsItemUnitsFetch = Boolean(itemId) && !isLoading && cachedLinks.length === 0;

  const { data: itemUnitsResponse, isLoading: itemUnitsLoading } = useApiQuery<ItemUnitRow[]>(
    ['item-units', { itemId }],
    '/inventory/item-units',
    { itemId, limit: 50 },
    { enabled: needsItemUnitsFetch, staleTime: 60_000 }
  );

  const unitLinks = useMemo(() => {
    if (cachedLinks.length > 0) return cachedLinks;
    const rows = itemUnitsResponse?.data ?? [];
    if (rows.length > 0) return itemUnitRowsToLinks(rows);
    if (value?.trim()) {
      return [
        {
          unitId: value,
          isBaseUnit: true,
          unit: { id: value, arabicName: 'الوحدة' },
        },
      ];
    }
    return [];
  }, [cachedLinks, itemUnitsResponse?.data, value]);

  if (!itemId) {
    return <span className="text-sm text-slate-400">—</span>;
  }

  if (isLoading || (needsItemUnitsFetch && itemUnitsLoading)) {
    return <span className="text-sm text-slate-500">…</span>;
  }

  if (unitLinks.length === 0) {
    return <span className="text-xs text-amber-700">لا وحدة مرتبطة</span>;
  }

  const effectiveValue = value || defaultUnitIdForItem(item) || unitLinks[0]?.unit?.id || unitLinks[0]?.unitId || '';

  return (
    <select
      className={className ?? selectCls}
      value={effectiveValue}
      disabled={disabled || unitLinks.length <= 1}
      onChange={(e) => onChange(e.target.value)}
      {...nativeSelectProps}
    >
      {unitLinks.map((link) => {
        const id = link.unit?.id ?? link.unitId;
        if (!id) return null;
        return (
          <option key={id} value={id}>
            {formatUnitLabel(link)}
          </option>
        );
      })}
    </select>
  );
}
