'use client';

import { useMemo, useState } from 'react';
import { AppTable, FilterToolbar, Button, StatusBadge } from '@/components/ui';
import { BrowseStatusFilter } from '@/components/erp/BrowseListFilters';
import { useApiQuery } from '@/lib/hooks/useApi';
import type { ExportColumnDef } from '@/lib/export/export-utils';

export type CurrencyRow = {
  id: string;
  serial?: number | string | null;
  code: string;
  symbol?: string | null;
  arabicName: string;
  englishName?: string | null;
  exchangeRate?: number | string | null;
  isActive?: boolean;
};

function matchesSearch(row: CurrencyRow, search: string): boolean {
  const q = search.trim().toLowerCase();
  if (!q) return true;
  const haystack = [
    row.serial,
    row.code,
    row.symbol,
    row.arabicName,
    row.englishName,
    row.exchangeRate,
    row.isActive === false ? 'غير نشطة' : 'نشطة',
  ]
    .filter((v) => v != null && String(v).length > 0)
    .join(' ')
    .toLowerCase();
  return haystack.includes(q);
}

export function CurrenciesListSection({
  onSelect,
  selectedId,
}: {
  onSelect?: (row: CurrencyRow) => void;
  selectedId?: string | null;
}) {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<'all' | 'active' | 'inactive'>('all');

  const { data, isLoading } = useApiQuery<CurrencyRow[]>(
    ['currencies', { page: 1, pageSize: 200 }],
    '/accounting/currencies',
    { page: 1, limit: 200 },
    { staleTime: 15_000 }
  );

  const allRows = useMemo(() => data?.data ?? [], [data?.data]);
  const filtered = useMemo(
    () =>
      allRows.filter((row) => {
        if (!matchesSearch(row, search)) return false;
        if (status === 'active' && row.isActive === false) return false;
        if (status === 'inactive' && row.isActive !== false) return false;
        return true;
      }),
    [allRows, search, status]
  );
  const rows = filtered.slice((page - 1) * pageSize, page * pageSize);

  const exportColumns: ExportColumnDef<CurrencyRow>[] = [
    { id: 'serial', header: 'المسلسل', getValue: (r) => String(r.serial ?? '') },
    { id: 'code', header: 'الرمز', accessor: 'code' },
    { id: 'symbol', header: 'الرمز المختصر', getValue: (r) => r.symbol || '' },
    { id: 'arabicName', header: 'الاسم العربي', accessor: 'arabicName' },
    { id: 'englishName', header: 'الاسم الإنجليزي', getValue: (r) => r.englishName || '' },
    { id: 'rate', header: 'سعر الصرف', getValue: (r) => String(r.exchangeRate ?? '') },
  ];

  return (
    <section className="space-y-4">
      <FilterToolbar
        searchPlaceholder="بحث بأي عمود: المسلسل، الرمز، الاسم، سعر الصرف…"
        onSearchChange={(v) => {
          setPage(1);
          setSearch(v);
        }}
        exportConfig={{
          fileName: 'currencies',
          columns: exportColumns as ExportColumnDef<Record<string, unknown>>[],
          rows: filtered as Record<string, unknown>[],
        }}
      >
        <BrowseStatusFilter
          value={status}
          onChange={(value) => {
            setPage(1);
            setStatus(value);
          }}
          options={[
            { value: 'all', label: 'كل الحالات' },
            { value: 'active', label: 'نشطة' },
            { value: 'inactive', label: 'غير نشطة' },
          ]}
        />
      </FilterToolbar>
      <AppTable<CurrencyRow>
        isLoading={isLoading}
        data={rows}
        getRowKey={(r) => r.id}
        emptyTitle="لا توجد عملات"
        emptyDescription="أضف عملة جديدة من قائمة الإجراءات."
        columns={[
          { id: 'serial', header: 'المسلسل', cell: (r) => r.serial ?? '—', sortValue: (r) => Number(r.serial) || 0 },
          { id: 'code', header: 'الرمز', accessor: 'code' },
          { id: 'symbol', header: 'الرمز', cell: (r) => r.symbol || '—' },
          { id: 'arabicName', header: 'الاسم العربي', accessor: 'arabicName' },
          { id: 'englishName', header: 'الإنجليزي', cell: (r) => r.englishName || '—' },
          {
            id: 'rate',
            header: 'سعر الصرف',
            cell: (r) => (r.exchangeRate != null && r.exchangeRate !== '' ? String(r.exchangeRate) : '—'),
          },
          {
            id: 'status',
            header: 'الحالة',
            align: 'center',
            cell: (r) => (
              <StatusBadge
                compact
                variant={r.isActive === false ? 'danger' : 'success'}
                label={r.isActive === false ? 'غير نشطة' : 'نشطة'}
              />
            ),
          },
          {
            id: 'actions',
            header: '',
            align: 'center',
            cell: (r) => (
              <Button
                variant={selectedId === r.id ? 'primary' : 'ghost'}
                size="sm"
                onClick={() => onSelect?.(r)}
              >
                فتح
              </Button>
            ),
          },
        ]}
        pagination={{
          page,
          pageSize,
          totalItems: filtered.length,
          onPageChange: setPage,
          onPageSizeChange: (n) => {
            setPage(1);
            setPageSize(n);
          },
        }}
      />
    </section>
  );
}
