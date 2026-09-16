'use client';

import { useMemo, useState } from 'react';
import { AppTable, FilterToolbar, StatusBadge, Button } from '@/components/ui';
import { useApiQuery } from '@/lib/hooks/useApi';
import { queryKeys } from '@/lib/query/query-keys';
import type { ExportColumnDef } from '@/lib/export/export-utils';

export type OtherAdditionRow = {
  id: string;
  serial?: string | null;
  name: string;
  abbreviation?: string | null;
  accountId?: string | null;
  offsetAccountId?: string | null;
  isActive?: boolean;
  base?: string | null;
  type?: string | null;
  percentages?: {
    source: string;
    sourceId?: string | null;
    sourceName?: string | null;
    percentage: number | string;
  }[];
};

export function OtherAdditionsListSection({
  onSelect,
  selectedId,
}: {
  onSelect?: (row: OtherAdditionRow) => void;
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

  const { data, isLoading } = useApiQuery<OtherAdditionRow[]>(
    queryKeys.otherAdditionDiscountTypes({ page, search }),
    '/inventory/other-addition-discount-types',
    queryParams,
    { staleTime: 15_000 }
  );

  const rows = data?.data ?? [];
  const total = data?.pagination?.total ?? data?.meta?.total ?? rows.length;

  const exportColumns: ExportColumnDef<OtherAdditionRow>[] = [
    { id: 'serial', header: 'المسلسل', getValue: (r) => r.serial || '' },
    { id: 'name', header: 'الاسم', accessor: 'name' },
    {
      id: 'kind',
      header: 'النوع',
      getValue: (r) => (r.type === 'discount' ? 'خصم' : 'إضافة'),
    },
  ];

  return (
    <section className="mb-6 space-y-4">
      <FilterToolbar
        searchPlaceholder="بحث بالاسم أو الاختصار أو المسلسل…"
        onSearchChange={(v) => {
          setPage(1);
          setSearch(v);
        }}
        exportConfig={{
          fileName: 'other-additions-discounts',
          columns: exportColumns as ExportColumnDef<Record<string, unknown>>[],
          rows: rows as Record<string, unknown>[],
        }}
      />
      <AppTable<OtherAdditionRow>
        isLoading={isLoading}
        data={rows}
        getRowKey={(r) => r.id}
        emptyTitle="لا توجد إضافات أو خصومات أخرى"
        columns={[
          { id: 'serial', header: 'المسلسل', cell: (r) => r.serial || '—' },
          { id: 'name', header: 'الاسم', accessor: 'name' },
          {
            id: 'kind',
            header: 'النوع',
            cell: (r) => (r.type === 'discount' ? 'خصم' : 'إضافة'),
          },
          {
            id: 'status',
            header: 'الحالة',
            align: 'center',
            cell: (r) => (
              <StatusBadge
                compact
                variant={r.isActive !== false ? 'success' : 'neutral'}
                label={r.isActive !== false ? 'نشط' : 'موقوف'}
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
