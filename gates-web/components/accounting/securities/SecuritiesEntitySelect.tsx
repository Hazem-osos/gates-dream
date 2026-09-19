'use client';

import { useMemo, useState } from 'react';
import { SearchableCombobox } from '@/app/components/form/SearchableCombobox';
import { useApiMutation, useApiQuery, useInvalidateQuery } from '@/lib/hooks/useApi';
import { compactControlClass } from '@/components/ui/forms/formTokens';

type EntityRow = { id: string; arabicName: string };

export function SecuritiesEntitySelect({
  value,
  valueLabel,
  onChange,
  disabled,
  className,
  placeholder = 'اختر الجهة أو أضف جهة جديدة',
}: {
  value: string;
  valueLabel?: string;
  onChange: (id: string, name: string) => void;
  disabled?: boolean;
  className?: string;
  placeholder?: string;
}) {
  const invalidateQuery = useInvalidateQuery();
  const [query, setQuery] = useState('');
  const { data, isFetching } = useApiQuery<EntityRow[]>(
    ['securities-entities', query],
    '/accounting/securities-entities',
    query ? { search: query } : undefined
  );
  const createMutation = useApiMutation<EntityRow, { arabicName: string }>(
    '/accounting/securities-entities',
    'POST',
    {
      showSuccessToast: false,
      onSuccess: (res) => {
        const created = (res as { data?: EntityRow })?.data;
        if (!created?.id) return;
        invalidateQuery(['securities-entities']);
        onChange(created.id, created.arabicName);
      },
    }
  );

  const options = useMemo(
    () =>
      (data?.data ?? []).map((row) => ({
        value: row.id,
        label: row.arabicName,
      })),
    [data?.data]
  );

  return (
    <SearchableCombobox
      value={value}
      valueLabel={valueLabel}
      onChange={(id) => {
        const match = options.find((row) => row.value === id);
        onChange(id, match?.label || valueLabel || '');
      }}
      options={options}
      disabled={disabled}
      loading={isFetching || createMutation.isPending}
      placeholder={placeholder}
      className={className || compactControlClass}
      emptyMessage="لا توجد جهات محفوظة"
      quickCreateLabel="حفظ الجهة"
      onQuickCreate={(name) => {
        const arabicName = name.trim();
        if (!arabicName) return;
        createMutation.mutate({ arabicName });
      }}
      onQueryChange={(q) => {
        setQuery(q);
        if (!value) onChange('', q.trim());
      }}
    />
  );
}
