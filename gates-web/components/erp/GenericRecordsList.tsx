'use client';

import { useMemo, useState, type ReactNode } from 'react';
import { AppTable, Button, FilterToolbar, StatusBadge, type StatusTone } from '@/components/ui';
import { useApiQuery } from '@/lib/hooks/useApi';
import { useResourcePermissions } from '@/lib/hooks/useResourcePermissions';
import type { ExportColumnDef } from '@/lib/export/export-utils';
import { savedDocumentRowStatus } from '@/lib/documents/document-status-labels';
import { BrowseDateRangeFilters, BrowseStatusFilter } from '@/components/erp/BrowseListFilters';
import {
  rowMatchesDateRange,
  rowMatchesPostedStatus,
  rowMatchesSearch,
  type BrowsePostedStatus,
} from '@/lib/browse/browse-list-match';
import {
  mapBrowseColumnToApiSort,
  pickBrowseCodeColumnId,
} from '@/lib/browse/browse-list-sort';

export type GenericRecordRow = {
  id: string;
  isPosted?: boolean;
  [key: string]: unknown;
};

export type GenericRecordColumn = {
  id: string;
  header: string;
  getValue: (row: GenericRecordRow) => string;
};

type Props = {
  apiPath: string;
  listKey: string;
  columns: GenericRecordColumn[];
  extraParams?: Record<string, string | number | boolean | undefined>;
  selectedId?: string | null;
  onSelect: (id: string, row: GenericRecordRow) => void;
  /** skip/take APIs (price quotes) vs page/limit */
  paging?: 'page' | 'skip';
  resolveStatus?: (row: GenericRecordRow) => { variant: StatusTone; label: string };
  rowActions?: (row: GenericRecordRow) => ReactNode;
  searchPlaceholder?: string;
  printTitle?: string;
};

export function GenericRecordsList({
  apiPath,
  listKey,
  columns,
  extraParams,
  selectedId,
  onSelect,
  paging = 'page',
  resolveStatus,
  rowActions,
  searchPlaceholder = 'بحث بالرقم أو الاسم…',
  printTitle,
}: Props) {
  const { canView } = useResourcePermissions();
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [search, setSearch] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [statusFilter, setStatusFilter] = useState<BrowsePostedStatus>('all');
  const defaultCodeColumnId = useMemo(
    () => pickBrowseCodeColumnId(columns.map((c) => c.id), columns.map((c) => c.header)),
    [columns]
  );
  const [sortBy, setSortBy] = useState(() => mapBrowseColumnToApiSort(defaultCodeColumnId));
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const hasLocalFilters = Boolean(search.trim() || startDate || endDate || statusFilter !== 'all');

  const extraKey = JSON.stringify(extraParams ?? {});
  const queryParams = useMemo(() => {
    const p: Record<string, string | number | boolean> = {};
    if (paging === 'skip') {
      p.skip = hasLocalFilters ? 0 : (page - 1) * pageSize;
      p.take = hasLocalFilters ? 200 : pageSize;
    } else {
      p.page = hasLocalFilters ? 1 : page;
      p.limit = hasLocalFilters ? 200 : pageSize;
    }
    if (search.trim()) p.search = search.trim();
    if (startDate) p.startDate = startDate;
    if (endDate) p.endDate = endDate;
    if (statusFilter === 'posted') {
      p.isPosted = true;
      p.isCancelled = false;
    } else if (statusFilter === 'draft') {
      p.isPosted = false;
      p.isCancelled = false;
    } else if (statusFilter === 'cancelled') {
      p.isCancelled = true;
    }
    p.sortBy = sortBy;
    p.sortDir = sortDir;
    const parsed = extraParams ?? {};
    for (const [k, v] of Object.entries(parsed)) {
      if (v !== undefined && v !== '') p[k] = v;
    }
    return p;
  }, [page, pageSize, paging, extraParams, search, startDate, endDate, statusFilter, hasLocalFilters, sortBy, sortDir]);

  const { data, isLoading } = useApiQuery<GenericRecordRow[]>(
    [listKey, page, pageSize, extraKey, search, startDate, endDate, statusFilter, sortBy, sortDir],
    apiPath,
    queryParams,
    { staleTime: 20_000, enabled: canView }
  );

  const fetchedRows = data?.data ?? [];
  const filteredRows = useMemo(() => {
    if (!hasLocalFilters) return fetchedRows;
    return fetchedRows.filter((row) => {
      if (!rowMatchesSearch(row, search)) return false;
      if (!rowMatchesDateRange(row, startDate, endDate)) return false;
      if (!rowMatchesPostedStatus(row, statusFilter)) return false;
      return true;
    });
  }, [fetchedRows, hasLocalFilters, search, startDate, endDate, statusFilter]);
  const rows = hasLocalFilters
    ? filteredRows.slice((page - 1) * pageSize, page * pageSize)
    : fetchedRows;
  const total = hasLocalFilters
    ? filteredRows.length
    : data?.pagination?.total ??
      (typeof (data as { pagination?: { total?: number } })?.pagination?.total === 'number'
        ? data!.pagination!.total
        : fetchedRows.length);

  const hasCallerStatus = columns.some((col) => col.id === 'status');
  const statusExportColumn: ExportColumnDef<GenericRecordRow> = {
    id: 'status',
    header: 'الحالة',
    getValue: (row) => {
      if (resolveStatus) return resolveStatus(row).label;
      return savedDocumentRowStatus(row).label;
    },
  };
  const exportColumns: ExportColumnDef<GenericRecordRow>[] = [
    ...columns.map((col) => ({
      id: col.id,
      header: col.header,
      getValue: (row: GenericRecordRow) => col.getValue(row),
    })),
    ...(hasCallerStatus ? [] : [statusExportColumn]),
  ];

  if (!canView) {
    return <p className="text-sm text-slate-500">لا توجد صلاحية لعرض هذه القائمة.</p>;
  }

  return (
    <div className="space-y-3">
      <FilterToolbar
        searchPlaceholder={searchPlaceholder}
        onSearchChange={(v) => {
          setPage(1);
          setSearch(v);
        }}
        exportConfig={{
          fileName: listKey,
          columns: exportColumns as ExportColumnDef<Record<string, unknown>>[],
          rows: (hasLocalFilters ? filteredRows : rows) as Record<string, unknown>[],
          printTitle: printTitle ?? 'السجلات السابقة',
        }}
      >
        <BrowseDateRangeFilters
          startDate={startDate}
          endDate={endDate}
          onStartDate={(value) => {
            setPage(1);
            setStartDate(value);
          }}
          onEndDate={(value) => {
            setPage(1);
            setEndDate(value);
          }}
        />
        <BrowseStatusFilter
          value={statusFilter}
          onChange={(value) => {
            setPage(1);
            setStatusFilter(value);
          }}
          options={[
            { value: 'all', label: 'كل الحالات' },
            { value: 'posted', label: 'مرحّل' },
            { value: 'draft', label: 'غير مرحّل' },
            { value: 'cancelled', label: 'ملغي' },
          ]}
        />
      </FilterToolbar>
      <AppTable<GenericRecordRow>
        columns={[
          ...columns
            .filter((col) => !(col.id === 'status' && resolveStatus))
            .map((col) => ({
              id: col.id,
              header: col.header,
              cell: (row: GenericRecordRow) => col.getValue(row),
              sortValue: (row: GenericRecordRow) =>
                /date/.test(col.id) ? Date.parse(String(row.date ?? row.createdAt ?? '')) || 0 : col.getValue(row),
            })),
          ...(hasCallerStatus && !resolveStatus
            ? []
            : [
                {
                  id: 'status',
                  header: 'الحالة',
                  cell: (row: GenericRecordRow) => {
                    const status = resolveStatus
                      ? resolveStatus(row)
                      : {
                          variant: savedDocumentRowStatus(row).tone,
                          label: savedDocumentRowStatus(row).label,
                        };
                    return <StatusBadge variant={status.variant} label={status.label} compact />;
                  },
                },
              ]),
          ...(rowActions
            ? [
                {
                  id: 'ops',
                  header: 'العمليات',
                  cell: (row: GenericRecordRow) => (
                    <div className="flex flex-wrap justify-end gap-1" onClick={(e) => e.stopPropagation()}>
                      {rowActions(row)}
                    </div>
                  ),
                },
              ]
            : []),
          {
            id: 'open',
            header: '',
            cell: (row: GenericRecordRow) => (
              <div className="flex flex-wrap justify-end gap-1" onClick={(e) => e.stopPropagation()}>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => onSelect(row.id, row)}
                >
                  فتح
                </Button>
              </div>
            ),
          },
        ]}
        data={rows}
        getRowKey={(row) => row.id}
        isLoading={isLoading}
        emptyTitle="لا توجد مستندات سابقة"
        onRowClick={(row) => onSelect(row.id, row)}
        rowClassName={(row) =>
          selectedId === row.id ? 'bg-sky-50 even:bg-sky-50 hover:bg-sky-100' : undefined
        }
        defaultSort={{ id: defaultCodeColumnId, dir: 'asc' }}
        onSortChange={(next) => {
          setPage(1);
          setSortBy(mapBrowseColumnToApiSort(next.id));
          setSortDir(next.dir);
        }}
        pagination={{
          page,
          pageSize,
          totalItems: total,
          onPageChange: setPage,
          onPageSizeChange: (n) => {
            setPage(1);
            setPageSize(n);
          },
        }}
      />
    </div>
  );
}
