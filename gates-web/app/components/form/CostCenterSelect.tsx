'use client';

import { memo, useMemo, useState } from 'react';
import { useCostCentersQuery, type CostCenterOption } from '@/lib/hooks/useMasterDataQueries';
import { SearchableCombobox } from '@/app/components/form/SearchableCombobox';
import { lazyNamedModal } from '@/components/ui/lazyModal';
import { compactControlClass } from '@/components/ui/forms/formTokens';

const QuickCreateCostCenterModal = lazyNamedModal(
  () => import('@/app/components/form/QuickCreateCostCenterModal'),
  'QuickCreateCostCenterModal',
  'جاري تحميل إضافة مركز تكلفة…'
);

const selectCls = compactControlClass;

function costCenterLabel(cc: { code?: string | null; arabicName: string }) {
  return cc.code ? `[${cc.code}] ${cc.arabicName}` : cc.arabicName;
}

function CostCenterSelectInner({
  value,
  onChange,
  disabled,
  className,
  allowEmpty = true,
  emptyLabel = '—',
  nativeSelectProps,
  enableQuickCreate = true,
}: {
  value: string;
  onChange: (id: string) => void;
  disabled?: boolean;
  className?: string;
  allowEmpty?: boolean;
  emptyLabel?: string;
  nativeSelectProps?: React.SelectHTMLAttributes<HTMLSelectElement> &
    Record<`data-${string}`, string | undefined>;
  enableQuickCreate?: boolean;
}) {
  const { data, isLoading, isError } = useCostCentersQuery();
  const rows = data?.data ?? [];
  const [quickOpen, setQuickOpen] = useState(false);
  const [quickName, setQuickName] = useState('');
  const [pinned, setPinned] = useState<CostCenterOption | null>(null);

  const merged = useMemo(() => {
    if (pinned && !rows.some((cc) => cc.id === pinned.id)) {
      return [pinned, ...rows];
    }
    return rows;
  }, [pinned, rows]);

  const options = useMemo(() => {
    const list = merged.map((cc) => ({
      value: cc.id,
      label: costCenterLabel(cc),
      searchText: `${cc.code ?? ''} ${cc.arabicName} ${cc.englishName ?? ''}`,
    }));
    if (allowEmpty) {
      return [{ value: '', label: emptyLabel, searchText: '' }, ...list];
    }
    return list;
  }, [allowEmpty, emptyLabel, merged]);

  const valueLabel = useMemo(() => {
    if (!value) return undefined;
    const hit = merged.find((cc) => cc.id === value);
    return hit ? costCenterLabel(hit) : undefined;
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
        emptyMessage={isError ? 'تعذر تحميل مراكز التكلفة' : 'لا توجد نتائج'}
        valueLabel={valueLabel}
        portaled
        menuPlacement="auto"
        quickCreateLabel={enableQuickCreate ? '+ إضافة سريع' : undefined}
        onQuickCreate={
          enableQuickCreate
            ? (query) => {
                setQuickName(query);
                setQuickOpen(true);
              }
            : undefined
        }
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
      {enableQuickCreate && quickOpen ? (
        <QuickCreateCostCenterModal
          open
          initialName={quickName}
          onClose={() => setQuickOpen(false)}
          onCreated={(costCenter) => {
            setPinned(costCenter);
            onChange(costCenter.id);
          }}
        />
      ) : null}
    </>
  );
}

export const CostCenterSelect = memo(CostCenterSelectInner);
