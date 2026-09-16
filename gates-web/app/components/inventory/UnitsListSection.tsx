'use client';

import { useMemo, useState } from 'react';
import { AppTable, FilterToolbar } from '@/components/ui';
import { useApiQuery } from '@/lib/hooks/useApi';
import { queryKeys } from '@/lib/query/query-keys';
import type { ExportColumnDef } from '@/lib/export/export-utils';

type UnitRow = {
  id: string;
  code?: string | null;
  arabicName: string;
  englishName?: string | null;
  [key: string]: unknown;
};

export function UnitsListSection() {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [search, setSearch] = useState('');

  const queryParams = useMemo(() => {
    const p: Record<string, string | number> = { page, limit: pageSize };
    if (search.trim()) p.search = search.trim();
    return p;
  }, [page, pageSize, search]);

  const { data, isLoading } = useApiQuery<UnitRow[]>(
    queryKeys.units({ page, search }),
    '/inventory/units',
    queryParams,
    { staleTime: 30_000 }
  );

  const rows = data?.data ?? [];
  const total = data?.pagination?.total ?? data?.meta?.total ?? rows.length;

  const exportColumns: ExportColumnDef<UnitRow>[] = [
    { id: 'code', header: 'الكود', getValue: (r) => r.code || '' },
    { id: 'name', header: 'الاسم', accessor: 'arabicName' },
  ];

  return (
    <section className="mb-8 space-y-4">
      <FilterToolbar
        searchPlaceholder="بحث بالكود أو اسم الوحدة…"
        onSearchChange={(v) => {
          setPage(1);
          setSearch(v);
        }}
        exportConfig={{
          fileName: 'units',
          columns: exportColumns as ExportColumnDef<Record<string, unknown>>[],
          rows: rows as Record<string, unknown>[],
        }}
      />

      <AppTable<UnitRow>
        isLoading={isLoading}
        data={rows}
        getRowKey={(r) => r.id}
        emptyTitle="لا توجد وحدات"
        columns={[
          { id: 'code', header: 'الكود', cell: (r) => r.code || '—' },
          { id: 'ar', header: 'الاسم العربي', accessor: 'arabicName' },
          { id: 'en', header: 'الاسم الإنجليزي', accessor: 'englishName' },
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
