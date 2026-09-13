'use client';

import { useMemo, useState } from 'react';
import { AppTable, FilterToolbar, Button } from '@/components/ui';
import { useApiQuery } from '@/lib/hooks/useApi';
import { queryKeys } from '@/lib/query/query-keys';
import type { ExportColumnDef } from '@/lib/export/export-utils';

export type CommissionValueRow = {
  id: string;
  serial?: string | null;
  name: string;
  target?: number | string | null;
  targetPercentage?: number | string | null;
  tiers?: { days?: number | null; commissionPct?: number | string | null }[];
};

export function CommissionValuesListSection({
  onSelect,
  selectedId,
}: {
  onSelect?: (row: CommissionValueRow) => void;
  selectedId?: string | null;
}) {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [search, setSearch] = useState('');

  const queryParams = useMemo(() => {
    const p: Record<string, string | number> = { page, limit: pageSize };
    if (search.trim().length >= 2) p.search = search.trim();
    return p;
  }, [page, pageSize, search]);

  const { data, isLoading } = useApiQuery<CommissionValueRow[]>(
    queryKeys.representativeCommissionValues({ page, search }),
    '/inventory/representatives-commissions-values',
    queryParams,
    { staleTime: 15_000 }
  );

  const rows = data?.data ?? [];
  const total = data?.pagination?.total ?? data?.meta?.total ?? rows.length;

  const exportColumns: ExportColumnDef<CommissionValueRow>[] = [
    { id: 'serial', header: 'المسلسل', getValue: (r) => r.serial || '' },
    { id: 'name', header: 'الاسم', accessor: 'name' },
    { id: 'target', header: 'التارجت', getValue: (r) => String(r.target ?? '') },
  ];

  return (
    <section className="mb-6 space-y-4">
      <FilterToolbar
        searchPlaceholder="بحث بالمسلسل أو الاسم…"
        onSearchChange={(v) => {
          setPage(1);
          setSearch(v);
        }}
        exportConfig={{
          fileName: 'commission-values',
          columns: exportColumns as ExportColumnDef<Record<string, unknown>>[],
          rows: rows as Record<string, unknown>[],
        }}
      />
      <AppTable<CommissionValueRow>
        isLoading={isLoading}
        data={rows}
        getRowKey={(r) => r.id}
        emptyTitle="لا توجد سياسات عمولة قيم"
        columns={[
          { id: 'serial', header: 'المسلسل', cell: (r) => r.serial || '—' },
          { id: 'name', header: 'الاسم', accessor: 'name' },
          { id: 'target', header: 'التارجت', cell: (r) => (r.target != null ? String(r.target) : '—') },
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
