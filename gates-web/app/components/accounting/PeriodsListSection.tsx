'use client';

import { useMemo, useState } from 'react';
import { AppTable, FilterToolbar, Button, StatusBadge } from '@/components/ui';
import { BrowseDateRangeFilters, BrowseStatusFilter } from '@/components/erp/BrowseListFilters';
import { useApiQuery } from '@/lib/hooks/useApi';
import type { ExportColumnDef } from '@/lib/export/export-utils';
import {
  compareBrowseValues,
  isoDatePart,
  rangeOverlaps,
} from '@/lib/browse/browse-list-match';

export type PeriodRow = {
  id: string;
  code: string;
  name: string;
  startDate: string;
  endDate: string;
  isClosed?: boolean;
  isActive?: boolean;
};

type PeriodStatus = 'all' | 'open' | 'closed';

function dateLabel(value: string | null | undefined): string {
  return isoDatePart(value) || '—';
}

function matchesSearch(row: PeriodRow, search: string): boolean {
  const q = search.trim().toLowerCase();
  if (!q) return true;
  const haystack = [
    row.code,
    row.name,
    dateLabel(row.startDate),
    dateLabel(row.endDate),
    row.isClosed ? 'مغلقة' : 'مفتوحة',
    row.isClosed ? 'closed' : 'open',
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
  return haystack.includes(q);
}

function periodSortValue(row: PeriodRow, id: string): string | number {
  if (id === 'code') return row.code || '';
  if (id === 'name') return row.name || '';
  if (id === 'start') return isoDatePart(row.startDate);
  if (id === 'end') return isoDatePart(row.endDate);
  if (id === 'status') return row.isClosed ? 1 : 0;
  return row.code || '';
}

export function PeriodsListSection({
  onSelect,
  selectedId,
  rows: rowsProp,
  isLoading: loadingProp,
}: {
  onSelect?: (row: PeriodRow) => void;
  selectedId?: string | null;
  rows?: PeriodRow[];
  isLoading?: boolean;
}) {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<PeriodStatus>('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [sort, setSort] = useState<{ id: string; dir: 'asc' | 'desc' }>({
    id: 'start',
    dir: 'desc',
  });

  const { data, isLoading: queryLoading } = useApiQuery<PeriodRow[]>(
    ['periods', { page: 1, pageSize: 200 }],
    '/accounting/periods',
    { page: 1, limit: 200 },
    { staleTime: 0, refetchOnMount: 'always', enabled: rowsProp == null }
  );

  const allRows = useMemo(
    () => rowsProp ?? data?.data ?? [],
    [data?.data, rowsProp]
  );
  const isLoading = loadingProp ?? queryLoading;
  const filtered = useMemo(() => {
    const next = allRows.filter((row) => {
      if (!matchesSearch(row, search)) return false;
      if (status === 'open' && row.isClosed) return false;
      if (status === 'closed' && !row.isClosed) return false;
      return rangeOverlaps(row.startDate, row.endDate, startDate, endDate);
    });
    next.sort((a, b) => {
      const cmp = compareBrowseValues(periodSortValue(a, sort.id), periodSortValue(b, sort.id));
      return sort.dir === 'asc' ? cmp : -cmp;
    });
    return next;
  }, [allRows, search, status, startDate, endDate, sort]);
  const rows = filtered.slice((page - 1) * pageSize, page * pageSize);

  const exportColumns: ExportColumnDef<PeriodRow>[] = [
    { id: 'code', header: 'المسلسل', getValue: (r) => r.code || '' },
    { id: 'name', header: 'الاسم', accessor: 'name' },
    { id: 'start', header: 'من تاريخ', getValue: (r) => dateLabel(r.startDate) },
    { id: 'end', header: 'إلى تاريخ', getValue: (r) => dateLabel(r.endDate) },
    { id: 'status', header: 'الحالة', getValue: (r) => (r.isClosed ? 'مغلقة' : 'مفتوحة') },
  ];

  const resetPage = () => setPage(1);

  return (
    <section className="mb-6 space-y-4">
      <FilterToolbar
        searchPlaceholder="بحث بأي عمود: المسلسل، الاسم، التاريخ، الحالة…"
        onSearchChange={(v) => {
          resetPage();
          setSearch(v);
        }}
        exportConfig={{
          fileName: 'accounting-periods',
          columns: exportColumns as ExportColumnDef<Record<string, unknown>>[],
          rows: filtered as Record<string, unknown>[],
        }}
      >
        <BrowseDateRangeFilters
          startDate={startDate}
          endDate={endDate}
          onStartDate={(value) => {
            resetPage();
            setStartDate(value);
          }}
          onEndDate={(value) => {
            resetPage();
            setEndDate(value);
          }}
        />
        <BrowseStatusFilter
          value={status}
          onChange={(value) => {
            resetPage();
            setStatus(value);
          }}
          options={[
            { value: 'all', label: 'كل الحالات' },
            { value: 'open', label: 'مفتوحة' },
            { value: 'closed', label: 'مغلقة' },
          ]}
        />
      </FilterToolbar>
      <AppTable<PeriodRow>
        isLoading={isLoading}
        data={rows}
        getRowKey={(r) => r.id}
        emptyTitle="لا توجد فترات محاسبية"
        emptyDescription="غيّر البحث أو التاريخ أو الحالة، أو أضف فترة جديدة."
        defaultSort={sort}
        onSortChange={(next) => {
          resetPage();
          setSort(next);
        }}
        columns={[
          { id: 'code', header: 'المسلسل', cell: (r) => r.code || '—', sortValue: (r) => r.code || '' },
          { id: 'name', header: 'الاسم', accessor: 'name' },
          { id: 'start', header: 'من تاريخ', cell: (r) => dateLabel(r.startDate), sortValue: (r) => isoDatePart(r.startDate) },
          { id: 'end', header: 'إلى تاريخ', cell: (r) => dateLabel(r.endDate), sortValue: (r) => isoDatePart(r.endDate) },
          {
            id: 'status',
            header: 'الحالة',
            align: 'center',
            cell: (r) => (
              <StatusBadge
                compact
                variant={r.isClosed ? 'danger' : 'success'}
                label={r.isClosed ? 'مغلقة' : 'مفتوحة'}
              />
            ),
            sortValue: (r) => (r.isClosed ? 1 : 0),
          },
          {
            id: 'actions',
            header: '',
            align: 'center',
            sortable: false,
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
