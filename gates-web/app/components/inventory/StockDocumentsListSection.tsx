'use client';

import { useMemo, useState } from 'react';
import {
  AppTable,
  FilterToolbar,
  StatusBadge,
  Button,
} from '@/components/ui';
import { useApiQuery } from '@/lib/hooks/useApi';
import type { ExportColumnDef } from '@/lib/export/export-utils';

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
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [search, setSearch] = useState('');
  const [postedFilter, setPostedFilter] = useState<'all' | 'posted' | 'draft'>('all');

  const queryParams = useMemo(() => {
    const p: Record<string, string | number | boolean> = { page, limit: pageSize };
    if (search.trim().length >= 2) p.search = search.trim();
    if (postedFilter === 'posted') p.isPosted = true;
    if (postedFilter === 'draft') p.isPosted = false;
    return p;
  }, [page, pageSize, search, postedFilter]);

  const { data, isLoading } = useApiQuery<DocRow[]>(
    [listKey, page, search, postedFilter],
    apiPath,
    queryParams,
    { staleTime: 30_000 }
  );

  const rows = data?.data ?? [];
  const total = data?.pagination?.total ?? data?.meta?.total ?? rows.length;

  const columns =
    variant === 'transfer'
      ? [
          {
            id: 'serial',
            header: 'المسلسل',
            cell: (r: DocRow) => r.serialNumber || r.serial || r.id,
          },
          {
            id: 'date',
            header: 'التاريخ',
            cell: (r: DocRow) =>
              r.date ? new Date(r.date).toLocaleDateString('ar-EG') : '—',
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
            cell: (r: DocRow) => (
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
            ),
          },
        ]
      : [
          {
            id: 'serial',
            header: 'المسلسل',
            cell: (r: DocRow) => r.serialNumber || r.serial || r.id,
          },
          {
            id: 'date',
            header: 'التاريخ',
            cell: (r: DocRow) =>
              r.date ? new Date(r.date).toLocaleDateString('ar-EG') : '—',
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
            cell: (r: DocRow) => (
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
            ),
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
        <select
          value={postedFilter}
          onChange={(e) => {
            setPage(1);
            setPostedFilter(e.target.value as 'all' | 'posted' | 'draft');
          }}
          className="h-10 rounded-lg border border-[#D6EAF3] bg-white px-3 text-sm"
        >
          <option value="all">الكل</option>
          <option value="posted">مرحّل</option>
          <option value="draft">مسودة</option>
        </select>
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
