'use client';

import { memo, useCallback, useEffect, useMemo, useState } from 'react';
import {
  formatItemLabel,
  useItemsQuery,
  PICKER_PAGE_SIZE,
  type ItemOption,
} from '@/lib/hooks/useMasterDataQueries';
import { SearchableCombobox } from '@/app/components/form/SearchableCombobox';
import type { QuickCreatedItem } from '@/app/components/form/QuickCreateItemModal';
import { useBarcodeScanner } from '@/lib/keyboard/useBarcodeScanner';
import { compactControlClass } from '@/components/ui/forms/formTokens';
import { toast } from '@/lib/feedback/toast';
import { findItemByBarcode } from '@/lib/inventory/findItemByBarcode';
import { availableFromItemOption } from '@/lib/inventory/fetch-warehouse-stock-balance';
import { useOpenQuickCreateTab } from '@/lib/quick-create/useQuickCreateTab';
import { apiClient } from '@/lib/api/client';

const selectCls = compactControlClass;

function itemSalePrice(item: ItemOption): number | null {
  if (typeof item.salesPrice === 'number') return item.salesPrice;
  if (item.itemPrices?.length) {
    const def = item.itemPrices.find((p) => p.priceList?.isDefault) ?? item.itemPrices[0];
    if (def?.price != null) return Number(def.price);
  }
  return null;
}

function ItemSelectInner({
  value,
  onChange,
  disabled,
  className,
  emptyLabel = 'اختر الصنف',
  allowEmpty = false,
  enableQuickCreate = true,
  onItemResolved,
  onAfterBarcodePick,
  inputProps,
  onInputKeyDown,
  menuPlacement = 'top',
  portaled = true,
  excludeIds,
  excludeAssembly = false,
  assemblyOnly = false,
  warehouseId,
  fallbackLabel,
  onQuickCreateClick,
}: {
  value: string;
  onChange: (id: string) => void;
  disabled?: boolean;
  className?: string;
  allowEmpty?: boolean;
  emptyLabel?: string;
  enableQuickCreate?: boolean;
  excludeIds?: string[];
  excludeAssembly?: boolean;
  /** Assembly / disassembly parent picker — only items marked تجميعي in the item card. */
  assemblyOnly?: boolean;
  /** Limit stock figures in the picker to one warehouse when set. */
  warehouseId?: string;
  fallbackLabel?: string;
  /** If set, plus/quick-create uses this instead of opening a new item-card tab. */
  onQuickCreateClick?: (query: string) => void;
  onItemResolved?: (item: ItemOption | QuickCreatedItem | undefined) => void;
  onAfterBarcodePick?: () => void;
  inputProps?: React.InputHTMLAttributes<HTMLInputElement> &
    Record<`data-${string}`, string | undefined>;
  onInputKeyDown?: (e: React.KeyboardEvent<HTMLInputElement>) => void;
  menuPlacement?: 'bottom' | 'top' | 'auto';
  portaled?: boolean;
  /** Kept for callers; plus now opens a tab instead of a modal. */
  quickCreateModal?: unknown;
}) {
  const [search, setSearch] = useState('');
  const itemFilter = useMemo(() => {
    const base = assemblyOnly
      ? { isAssembly: true }
      : excludeAssembly
        ? { isAssembly: false }
        : undefined;
    if (!warehouseId) return base;
    return { ...(base ?? {}), warehouseId };
  }, [assemblyOnly, excludeAssembly, warehouseId]);
  const { data, isLoading, isError } = useItemsQuery(PICKER_PAGE_SIZE, search, itemFilter);
  const items = data?.data ?? [];
  const [pinnedItem, setPinnedItem] = useState<ItemOption | QuickCreatedItem | null>(null);

  useEffect(() => {
    if (!value) return;
    let cancelled = false;
    void apiClient
      .get<ItemOption>(`/inventory/items/${value}`, undefined, { skipErrorNotify: true })
      .then((res) => {
        const row = res.data;
        if (cancelled || !row?.id) return;
        setPinnedItem(row);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [value]);

  const mergedItems = useMemo(() => {
    if (pinnedItem && !items.some((it) => it.id === pinnedItem.id)) {
      return [pinnedItem as ItemOption, ...items];
    }
    return items;
  }, [items, pinnedItem]);

  const blocked = useMemo(() => new Set((excludeIds ?? []).filter(Boolean)), [excludeIds]);
  const visibleItems = useMemo(
    () =>
      mergedItems.filter((item) => {
        if (blocked.has(item.id)) return false;
        if (assemblyOnly && !item.isAssembly) return false;
        if (excludeAssembly && item.isAssembly) return false;
        return true;
      }),
    [assemblyOnly, blocked, excludeAssembly, mergedItems]
  );

  const options = useMemo(() => {
    const rows = visibleItems.map((item: ItemOption) => {
      const code = item.code || item.serial || '';
      return {
        value: item.id,
        label: formatItemLabel(item),
        searchText: `${code} ${item.arabicName} ${item.englishName ?? ''}`,
        meta: item,
      };
    });
    if (!allowEmpty) return rows;
    return [{ value: '', label: emptyLabel, searchText: emptyLabel }, ...rows];
  }, [allowEmpty, emptyLabel, visibleItems]);

  const resolveBarcode = (code: string) => {
    void findItemByBarcode(code, mergedItems).then((found) => {
      if (!found) {
        toast.error('الباركود غير مسجل');
        return;
      }
      if (assemblyOnly && !found.isAssembly) {
        toast.error('هذا الصنف ليس تجميعياً');
        return;
      }
      if (excludeAssembly && found.isAssembly) {
        toast.error('لا يمكن اختيار صنف تجميعي هنا');
        return;
      }
      setPinnedItem(found);
      onChange(found.id);
      onItemResolved?.(found);
      onAfterBarcodePick?.();
    });
  };

  const { onKeyDown: barcodeKeyDown } = useBarcodeScanner(resolveBarcode);

  const handleChange = (id: string) => {
    onChange(id);
    const picked = visibleItems.find((it) => it.id === id);
    if (picked) setPinnedItem(picked);
    onItemResolved?.(picked);
  };

  const handleQueryChange = useCallback((q: string) => {
    setSearch(q);
  }, []);

  useEffect(() => {
    if (!value) setSearch('');
  }, [value]);

  const openQuickCreateTab = useOpenQuickCreateTab('item', (entity) => {
    const item = {
      id: entity.id,
      arabicName: entity.arabicName || entity.label,
      code: entity.code ?? undefined,
      isAssembly: false,
    } as ItemOption;
    setPinnedItem(item);
    onChange(item.id);
    onItemResolved?.(item);
  });
  const openQuickCreate = onQuickCreateClick ?? openQuickCreateTab;

  const valueLabel = useMemo(() => {
    if (!value) return undefined;
    const hit = visibleItems.find((it) => it.id === value) ?? mergedItems.find((it) => it.id === value);
    if (hit) return formatItemLabel(hit);
    return fallbackLabel || undefined;
  }, [fallbackLabel, mergedItems, value, visibleItems]);

  return (
    <>
      <SearchableCombobox
        value={value}
        onChange={handleChange}
        options={options}
        valueLabel={valueLabel}
        disabled={disabled}
        className={className ?? selectCls}
        listClassName="w-[32rem]"
        portaled={portaled}
        menuPlacement={menuPlacement}
        onQueryChange={handleQueryChange}
        maxVisible={PICKER_PAGE_SIZE}
        renderOption={(opt) => {
          const item = mergedItems.find((it) => it.id === opt.value);
          if (!item) return opt.label;
          const code = item.code || item.serial || '—';
          const price = itemSalePrice(item);
          const available = availableFromItemOption(item);
          const onHand = item.quantityOnHand;
          const reserved = item.reservedQuantity;
          return (
            <div className="py-2 px-1 text-right space-y-1">
              <div className="flex flex-wrap items-center gap-2 justify-end">
                <span className="font-bold text-slate-900">{item.arabicName}</span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
                  {code}
                </span>
              </div>
              <div className="flex flex-wrap gap-2 justify-end text-xs text-slate-600">
                {available != null ? (
                  <span className="px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-800">
                    المتاح: {Number(available).toLocaleString('ar-EG')}
                    {reserved != null && Number(reserved) > 0 && onHand != null ? (
                      <span className="text-emerald-900/70">
                        {' '}
                        (موجود {Number(onHand).toLocaleString('ar-EG')} · محجوز{' '}
                        {Number(reserved).toLocaleString('ar-EG')})
                      </span>
                    ) : null}
                  </span>
                ) : null}
                {price != null && price > 0 ? (
                  <span className="font-medium text-[#0E78AA]">{price.toLocaleString()} ج.م</span>
                ) : null}
              </div>
            </div>
          );
        }}
        placeholder={emptyLabel}
        loading={isLoading}
        error={isError}
        emptyMessage={isError ? 'تعذر تحميل الأصناف' : 'لا يوجد صنف مطابق'}
        quickCreateLabel={enableQuickCreate && !assemblyOnly ? '+ إضافة سريع' : undefined}
        onQuickCreate={
          enableQuickCreate && !assemblyOnly ? (q) => openQuickCreate(q) : undefined
        }
        inputProps={{
          ...inputProps,
          onKeyDown: (e) => {
            barcodeKeyDown(e);
            onInputKeyDown?.(e);
          },
        }}
        onInputKeyDown={undefined}
        clientSearchEntity="items"
      />
    </>
  );
}

export const ItemSelect = memo(ItemSelectInner);

export type { ItemOption };
