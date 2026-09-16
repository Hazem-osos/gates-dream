'use client';

import { useMemo, useState } from 'react';
import {
  AppTable,
  FilterToolbar,
  StatusBadge,
  Button,
} from '@/components/ui';
import { useApiQuery } from '@/lib/hooks/useApi';
import { useQueryClient } from '@tanstack/react-query';
import type { ExportColumnDef } from '@/lib/export/export-utils';
import { toast } from '@/lib/feedback/toast';
import { confirmAction } from '@/lib/feedback/confirm';
import { deleteDraftDocument } from '@/lib/documents/deleteDraftDocument';
import { BrowseDateRangeFilters, BrowseStatusFilter } from '@/components/erp/BrowseListFilters';
import {
  rowMatchesDateRange,
  rowMatchesPostedStatus,
  rowMatchesSearch,
  type BrowsePostedStatus,
} from '@/lib/browse/browse-list-match';

type DocRow = {
  id: string;
  serialNumber?: string | null;
  serial?: string | null;
  date?: string;
  isPosted?: boolean;
  warehouse?: { arabicName?: string };
  fromWarehouse?: { arabicName?: string };
  toWarehouse?: { arabicName?: string };
  [key: string]: unknown;
};

export function StockDocumentsListSection({
  title,
  apiPath,
  listKey,
  variant,
  selectedId,
  onSelect,
}: {
  title: string;
  apiPath: string;
  listKey: string;
  variant: 'issue' | 'receipt' | 'transfer';
  selectedId: string | null;
  onSelect: (id: string | null) => void;
}) {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [search, setSearch] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [postedFilter, setPostedFilter] = useState<BrowsePostedStatus>('all');
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const hasLocalFilters = Boolean(search.trim() || startDate || endDate || postedFilter !== 'all');

  const draftActions = (r: DocRow) => (
    <div className="flex flex-wrap items-center justify-center gap-1.5">
      <Button
        variant="secondary"
        size="sm"
        onClick={(e) => {
          e.stopPropagation();
          onSelect(r.id);
        }}
      >
        فتح
      </Button>
      {!r.isPosted ? (
        <Button
          variant="danger"
          size="sm"
          disabled={deletingId === r.id}
          onClick={async (e) => {
            e.stopPropagation();
            if (!(await confirmAction('حذف هذه المسودة؟'))) return;
            setDeletingId(r.id);
            try {
              await deleteDraftDocument(apiPath, r.id);
              toast.success('تم حذف المسودة');
              await queryClient.invalidateQueries({ queryKey: [listKey] });
            } catch (error) {
              toast.error(error instanceof Error ? error.message : 'تعذر حذف المسودة');
            } finally {
              setDeletingId(null);
            }
          }}
        >
          حذف المسودة
        </Button>
      ) : null}
    </div>
  );

  const queryParams = useMemo(() => {
    const p: Record<string, string | number | boolean> = {
      page: hasLocalFilters ? 1 : page,
      limit: hasLocalFilters ? 200 : pageSize,
    };
    if (search.trim()) p.search = search.trim();
    if (startDate) p.startDate = startDate;
    if (endDate) p.endDate = endDate;
    if (postedFilter === 'posted') p.isPosted = true;
    if (postedFilter === 'draft') p.isPosted = false;
    return p;
  }, [page, pageSize, search, startDate, endDate, postedFilter, hasLocalFilters]);

  const { data, isLoading } = useApiQuery<DocRow[]>(
    [listKey, page, search, startDate, endDate, postedFilter],
    apiPath,
    queryParams,
    { staleTime: 30_000 }
  );

  const fetchedRows = data?.data ?? [];
  const filteredRows = useMemo(() => {
    if (!hasLocalFilters) return fetchedRows;
    return fetchedRows.filter((row) => {
      if (!rowMatchesSearch(row, search)) return false;
      if (!rowMatchesDateRange(row, startDate, endDate)) return false;
      if (!rowMatchesPostedStatus(row, postedFilter)) return false;
      return true;
    });
  }, [fetchedRows, hasLocalFilters, search, startDate, endDate, postedFilter]);
  const rows = hasLocalFilters
    ? filteredRows.slice((page - 1) * pageSize, page * pageSize)
    : fetchedRows;
  const total = hasLocalFilters
    ? filteredRows.length
    : data?.pagination?.total ?? data?.meta?.total ?? fetchedRows.length;

  const columns =
    variant === 'transfer'
      ? [
          {
            id: 'serial',
            header: 'المسلسل',
            cell: (r: DocRow) => r.serialNumber || r.serial || r.id,
            sortValue: (r: DocRow) => r.serialNumber || r.serial || r.id,
          },
          {
            id: 'date',
            header: 'التاريخ',
            cell: (r: DocRow) =>
              r.date ? new Date(r.date).toLocaleDateString('ar-EG') : '—',
            sortValue: (r: DocRow) => (r.date ? Date.parse(String(r.date)) : 0),
          },
          { id: 'from', header: 'من مخزن', cell: (r: DocRow) => r.fromWarehouse?.arabicName || '—' },
          { id: 'to', header: 'إلى مخزن', cell: (r: DocRow) => r.toWarehouse?.arabicName || '—' },
          {
            id: 'status',
            header: 'الحالة',
            align: 'center' as const,
            cell: (r: DocRow) => (
              <StatusBadge
                compact
                variant={r.isPosted ? 'success' : 'warning'}
                label={r.isPosted ? 'مرحّل' : 'مسودة'}
              />
            ),
          },
          {
            id: 'actions',
            header: '',
            align: 'center' as const,
            cell: (r: DocRow) => draftActions(r),
          },
        ]
      : [
          {
            id: 'serial',
            header: 'المسلسل',
            cell: (r: DocRow) => r.serialNumber || r.serial || r.id,
            sortValue: (r: DocRow) => r.serialNumber || r.serial || r.id,
          },
          {
            id: 'date',
            header: 'التاريخ',
            cell: (r: DocRow) =>
              r.date ? new Date(r.date).toLocaleDateString('ar-EG') : '—',
            sortValue: (r: DocRow) => (r.date ? Date.parse(String(r.date)) : 0),
          },
          {
            id: 'wh',
            header: 'المخزن',
            cell: (r: DocRow) => r.warehouse?.arabicName || '—',
          },
          {
            id: 'status',
            header: 'الحالة',
            align: 'center' as const,
            cell: (r: DocRow) => (
              <StatusBadge
                compact
                variant={r.isPosted ? 'success' : 'warning'}
                label={r.isPosted ? 'مرحّل' : 'مسودة'}
              />
            ),
          },
          {
            id: 'actions',
            header: '',
            align: 'center' as const,
            cell: (r: DocRow) => draftActions(r),
          },
        ];

  const exportColumns: ExportColumnDef<DocRow>[] =
    variant === 'transfer'
      ? [
          { id: 'serial', header: 'المسلسل', getValue: (r) => r.serialNumber || r.serial || r.id },
          {
            id: 'date',
            header: 'التاريخ',
            getValue: (r) => (r.date ? new Date(r.date).toLocaleDateString('ar-EG') : ''),
          },
          { id: 'from', header: 'من مخزن', getValue: (r) => r.fromWarehouse?.arabicName || '' },
          { id: 'to', header: 'إلى مخزن', getValue: (r) => r.toWarehouse?.arabicName || '' },
          { id: 'status', header: 'الحالة', getValue: (r) => (r.isPosted ? 'مرحّل' : 'مسودة') },
        ]
      : [
          { id: 'serial', header: 'المسلسل', getValue: (r) => r.serialNumber || r.serial || r.id },
          {
            id: 'date',
            header: 'التاريخ',
            getValue: (r) => (r.date ? new Date(r.date).toLocaleDateString('ar-EG') : ''),
          },
          { id: 'wh', header: 'المخزن', getValue: (r) => r.warehouse?.arabicName || '' },
          { id: 'status', header: 'الحالة', getValue: (r) => (r.isPosted ? 'مرحّل' : 'مسودة') },
        ];

  return (
    <section className="space-y-3">
      {title ? <h2 className="text-lg font-semibold text-[#0E78AA]">{title}</h2> : null}
      <FilterToolbar
        searchPlaceholder="بحث بالمسلسل…"
        onSearchChange={(v) => {
          setPage(1);
          setSearch(v);
        }}
        exportConfig={{
          fileName: listKey,
          columns: exportColumns as ExportColumnDef<Record<string, unknown>>[],
          rows: rows as Record<string, unknown>[],
          printTitle: title || 'السندات السابقة',
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
          value={postedFilter}
          onChange={(value) => {
            setPage(1);
            setPostedFilter(value);
          }}
          options={[
            { value: 'all', label: 'كل الحالات' },
            { value: 'posted', label: 'مرحّل' },
            { value: 'draft', label: 'مسودة' },
          ]}
        />
      </FilterToolbar>

      <AppTable<DocRow>
        isLoading={isLoading}
        data={rows}
        getRowKey={(r) => r.id}
        emptyTitle="لا توجد سندات"
        stickyHeader
        onRowClick={(r) => onSelect(r.id)}
        rowClassName={(r) =>
          selectedId === r.id ? 'bg-sky-50 even:bg-sky-50 hover:bg-sky-100' : undefined
        }
        columns={columns}
        defaultSort={{ id: 'serial', dir: 'asc' }}
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
    </section>
  );
}
