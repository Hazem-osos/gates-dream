'use client';

import { useMemo, useState } from 'react';
import { AppTable, FilterToolbar, Button, StatusBadge } from '@/components/ui';
import { useApiQuery } from '@/lib/hooks/useApi';
import type { ExportColumnDef } from '@/lib/export/export-utils';

export type PeriodRow = {
  id: string;
  code: string;
  name: string;
  startDate: string;
  endDate: string;
  isClosed?: boolean;
  isActive?: boolean;
};

function dateLabel(value: string | null | undefined): string {
  if (!value) return '—';
  if (/^\d{4}-\d{2}-\d{2}/.test(value)) return value.slice(0, 10);
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function PeriodsListSection({
  onSelect,
  selectedId,
}: {
  onSelect?: (row: PeriodRow) => void;
  selectedId?: string | null;
}) {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [search, setSearch] = useState('');

  const queryParams = useMemo(() => {
    const p: Record<string, string | number | boolean> = { page, limit: pageSize };
    if (search.trim().length >= 2) p.search = search.trim();
    return p;
  }, [page, pageSize, search]);

  const { data, isLoading } = useApiQuery<PeriodRow[]>(
    ['periods', { page, search, pageSize }],
    '/accounting/periods',
    queryParams,
    { staleTime: 15_000 }
  );

  const rows = useMemo(() => data?.data ?? [], [data?.data]);
  const total = data?.pagination?.total ?? data?.meta?.total ?? rows.length;

  const exportColumns: ExportColumnDef<PeriodRow>[] = [
    { id: 'code', header: 'المسلسل', getValue: (r) => r.code || '' },
    { id: 'name', header: 'الاسم', accessor: 'name' },
    { id: 'start', header: 'من تاريخ', getValue: (r) => dateLabel(r.startDate) },
    { id: 'end', header: 'إلى تاريخ', getValue: (r) => dateLabel(r.endDate) },
    { id: 'status', header: 'الحالة', getValue: (r) => (r.isClosed ? 'مغلقة' : 'مفتوحة') },
  ];

  return (
    <section className="mb-6 space-y-4">
      <FilterToolbar
        searchPlaceholder="بحث بالمسلسل أو اسم الفترة…"
        onSearchChange={(v) => {
          setPage(1);
          setSearch(v);
        }}
        exportConfig={{
          fileName: 'accounting-periods',
          columns: exportColumns as ExportColumnDef<Record<string, unknown>>[],
          rows: rows as Record<string, unknown>[],
        }}
      />
      <AppTable<PeriodRow>
        isLoading={isLoading}
        data={rows}
        getRowKey={(r) => r.id}
        emptyTitle="لا توجد فترات محاسبية"
        emptyDescription="أضف فترة جديدة من قائمة الإجراءات."
        columns={[
          { id: 'code', header: 'المسلسل', cell: (r) => r.code || '—' },
          { id: 'name', header: 'الاسم', accessor: 'name' },
          { id: 'start', header: 'من تاريخ', cell: (r) => dateLabel(r.startDate) },
          { id: 'end', header: 'إلى تاريخ', cell: (r) => dateLabel(r.endDate) },
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
                اختيار
              </Button>
            ),
          },
        ]}
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
