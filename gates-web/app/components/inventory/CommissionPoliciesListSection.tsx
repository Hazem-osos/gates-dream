'use client';

import { useMemo, useState } from 'react';
import { AppTable, FilterToolbar, Button } from '@/components/ui';
import { useApiQuery } from '@/lib/hooks/useApi';
import { queryKeys } from '@/lib/query/query-keys';
import type { ExportColumnDef } from '@/lib/export/export-utils';

export type CommissionPolicyRow = {
  id: string;
  code?: string | null;
  arabicName: string;
  englishName?: string | null;
  tiers?: {
    targetSlice?: string | null;
    targetPct?: number | string | null;
    commissionPct?: number | string | null;
    bonusPct?: number | string | null;
    increasePct?: number | string | null;
  }[];
};

export function CommissionPoliciesListSection({
  onSelect,
  selectedId,
}: {
  onSelect?: (row: CommissionPolicyRow) => void;
  selectedId?: string | null;
}) {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [search, setSearch] = useState('');

  const queryParams = useMemo(() => {
    const p: Record<string, string | number> = { page, limit: pageSize };
    if (search.trim()) p.search = search.trim();
    return p;
  }, [page, pageSize, search]);

  const { data, isLoading } = useApiQuery<CommissionPolicyRow[]>(
    queryKeys.representativeCommissionPolicies({ page, search }),
    '/inventory/representatives-commissions-policy',
    queryParams,
    { staleTime: 15_000 }
  );

  const rows = data?.data ?? [];
  const total = data?.pagination?.total ?? data?.meta?.total ?? rows.length;

  const exportColumns: ExportColumnDef<CommissionPolicyRow>[] = [
    { id: 'code', header: 'الكود', getValue: (r) => r.code || '' },
    { id: 'name', header: 'الاسم', accessor: 'arabicName' },
  ];

  return (
    <section className="mb-6 space-y-4">
      <FilterToolbar
        searchPlaceholder="بحث بالكود أو الاسم…"
        onSearchChange={(v) => {
          setPage(1);
          setSearch(v);
        }}
        exportConfig={{
          fileName: 'commission-policies',
          columns: exportColumns as ExportColumnDef<Record<string, unknown>>[],
          rows: rows as Record<string, unknown>[],
        }}
      />
      <AppTable<CommissionPolicyRow>
        isLoading={isLoading}
        data={rows}
        getRowKey={(r) => r.id}
        emptyTitle="لا توجد سياسات عمولة"
        columns={[
          { id: 'code', header: 'الكود', cell: (r) => r.code || '—' },
          { id: 'name', header: 'الاسم العربي', accessor: 'arabicName' },
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
