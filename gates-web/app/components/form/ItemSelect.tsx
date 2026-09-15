'use client';

import { memo, useCallback, useMemo, useState } from 'react';
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
import { useOpenQuickCreateTab } from '@/lib/quick-create/useQuickCreateTab';

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
  enableQuickCreate = true,
  onItemResolved,
  onAfterBarcodePick,
  inputProps,
  onInputKeyDown,
  menuPlacement = 'top',
  portaled = true,
}: {
  value: string;
  onChange: (id: string) => void;
  disabled?: boolean;
  className?: string;
  allowEmpty?: boolean;
  emptyLabel?: string;
  enableQuickCreate?: boolean;
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
  const { data, isLoading, isError } = useItemsQuery(PICKER_PAGE_SIZE, search);
  const items = data?.data ?? [];
  const [pinnedItem, setPinnedItem] = useState<ItemOption | QuickCreatedItem | null>(null);

  const mergedItems = useMemo(() => {
    if (pinnedItem && !items.some((it) => it.id === pinnedItem.id)) {
      return [pinnedItem as ItemOption, ...items];
    }
    return items;
  }, [items, pinnedItem]);

  const options = useMemo(
    () =>
      mergedItems.map((item: ItemOption) => {
        const code = item.code || item.serial || '';
        return {
          value: item.id,
          label: formatItemLabel(item),
          searchText: `${code} ${item.arabicName} ${item.englishName ?? ''}`,
          meta: item,
        };
      }),
    [mergedItems]
  );

  const resolveBarcode = (code: string) => {
    void findItemByBarcode(code, mergedItems).then((found) => {
      if (!found) {
        toast.error('الباركود غير مسجل');
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
    const picked = mergedItems.find((it) => it.id === id);
    if (picked) setPinnedItem(picked);
    onItemResolved?.(picked);
  };

  const handleQueryChange = useCallback((q: string) => {
    setSearch(q);
  }, []);

  const openQuickCreate = useOpenQuickCreateTab('item', (entity) => {
    const item = {
      id: entity.id,
      arabicName: entity.arabicName || entity.label,
      code: entity.code ?? undefined,
    } as ItemOption;
    setPinnedItem(item);
    onChange(item.id);
    onItemResolved?.(item);
  });

  const valueLabel = useMemo(() => {
    if (!value) return undefined;
    const hit = mergedItems.find((it) => it.id === value);
    return hit ? formatItemLabel(hit) : undefined;
  }, [mergedItems, value]);

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
          const stock = item.onHandQuantity;
          return (
            <div className="py-2 px-1 text-right space-y-1">
              <div className="flex flex-wrap items-center gap-2 justify-end">
                <span className="font-bold text-slate-900">{item.arabicName}</span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
                  {code}
                </span>
              </div>
              <div className="flex flex-wrap gap-2 justify-end text-xs text-slate-600">
                {stock != null ? (
                  <span className="px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-800">
                    المتاح: {Number(stock).toLocaleString('ar-EG')} قطعة
                  </span>
                ) : null}
                {price != null && price > 0 ? (
                  <span className="font-medium text-[#0E79AA]">{price.toFixed(2)} ج.م</span>
                ) : null}
              </div>
            </div>
          );
        }}
        placeholder={emptyLabel}
        loading={isLoading}
        error={isError}
        emptyMessage={isError ? 'تعذر تحميل الأصناف' : 'لا يوجد صنف مطابق'}
        quickCreateLabel={enableQuickCreate ? '+ إضافة سريع' : undefined}
        onQuickCreate={enableQuickCreate ? (q) => openQuickCreate(q) : undefined}
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
