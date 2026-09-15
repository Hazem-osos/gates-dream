'use client';

import { useMemo, useState, type ReactNode } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { AppTable, Button, FilterToolbar, StatusBadge, type StatusTone } from '@/components/ui';
import { useApiQuery } from '@/lib/hooks/useApi';
import { useResourcePermissions } from '@/lib/hooks/useResourcePermissions';
import type { ExportColumnDef } from '@/lib/export/export-utils';
import { toast } from '@/lib/feedback/toast';
import { deleteDraftDocument, isDraftDocumentRow } from '@/lib/documents/deleteDraftDocument';

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
  allowDeleteDraft?: boolean;
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
  allowDeleteDraft = true,
}: Props) {
  const { canView } = useResourcePermissions();
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [search, setSearch] = useState('');
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState('number');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

  const extraKey = JSON.stringify(extraParams ?? {});
  const queryParams = useMemo(() => {
    const p: Record<string, string | number | boolean> = {};
    if (paging === 'skip') {
      p.skip = (page - 1) * pageSize;
      p.take = pageSize;
    } else {
      p.page = page;
      p.limit = pageSize;
    }
    if (search.trim().length >= 2) p.search = search.trim();
    p.sortBy = sortBy;
    p.sortDir = sortDir;
    const parsed = extraParams ?? {};
    for (const [k, v] of Object.entries(parsed)) {
      if (v !== undefined && v !== '') p[k] = v;
    }
    return p;
  }, [page, pageSize, paging, extraParams, search, sortBy, sortDir]);

  const { data, isLoading } = useApiQuery<GenericRecordRow[]>(
    [listKey, page, pageSize, extraKey, search, sortBy, sortDir],
    apiPath,
    queryParams,
    { staleTime: 20_000, enabled: canView }
  );

  const rows = data?.data ?? [];
  const total =
    data?.pagination?.total ??
    (typeof (data as { pagination?: { total?: number } })?.pagination?.total === 'number'
      ? data!.pagination!.total
      : rows.length);

  const hasCallerStatus = columns.some((col) => col.id === 'status');
  const statusExportColumn: ExportColumnDef<GenericRecordRow> = {
    id: 'status',
    header: 'الحالة',
    getValue: (row) => {
      if (resolveStatus) return resolveStatus(row).label;
      return row.isPosted ? 'مرحّل' : 'مسودة';
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
          rows: rows as Record<string, unknown>[],
          printTitle: printTitle ?? 'السجلات السابقة',
        }}
      />
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
                          variant: (row.isPosted ? 'success' : 'warning') as StatusTone,
                          label: row.isPosted ? 'مرحّل' : 'مسودة',
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
                {allowDeleteDraft && isDraftDocumentRow(row) ? (
                  <Button
                    size="sm"
                    variant="danger"
                    disabled={deletingId === row.id}
                    onClick={async () => {
                      if (!window.confirm('حذف هذه المسودة؟')) return;
                      setDeletingId(row.id);
                      try {
                        await deleteDraftDocument(apiPath, row.id);
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
        defaultSort={{ id: columns[0]?.id ?? 'num', dir: 'asc' }}
        onSortChange={(next) => {
          setPage(1);
          setSortBy(/date/.test(next.id) ? 'date' : /amount|total/.test(next.id) ? 'amount' : 'number');
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
