'use client';

import { useMemo, useState } from 'react';
import { AppTable, FilterToolbar, Button } from '@/components/ui';
import { useApiQuery } from '@/lib/hooks/useApi';
import { queryKeys } from '@/lib/query/query-keys';
import type { ExportColumnDef } from '@/lib/export/export-utils';

export type PriceListRow = {
  id: string;
  code?: string | null;
  arabicName: string;
  englishName?: string | null;
  description?: string | null;
  discountPercentage?: number | string | null;
  currencyCode?: string | null;
  priceMode?: string | null;
  isActive?: boolean;
};

export function PriceListsListSection({
  onSelect,
  selectedId,
}: {
  onSelect?: (row: PriceListRow) => void;
  selectedId?: string | null;
}) {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [search, setSearch] = useState('');

  const queryParams = useMemo(() => {
    const p: Record<string, string | number | boolean> = {
      page,
      limit: pageSize,
      isActive: true,
    };
    if (search.trim()) p.search = search.trim();
    return p;
  }, [page, pageSize, search]);

  const { data, isLoading } = useApiQuery<PriceListRow[]>(
    queryKeys.priceLists({ page, search }),
    '/inventory/price-lists',
    queryParams,
    { staleTime: 15_000 }
  );

  const rows = data?.data ?? [];
  const total = data?.pagination?.total ?? data?.meta?.total ?? rows.length;

  const exportColumns: ExportColumnDef<PriceListRow>[] = [
    { id: 'code', header: 'الكود', getValue: (r) => r.code || '' },
    { id: 'name', header: 'الاسم', accessor: 'arabicName' },
    { id: 'currency', header: 'العملة', getValue: (r) => r.currencyCode || '' },
  ];

  return (
    <section className="mb-6 space-y-4">
      <FilterToolbar
        searchPlaceholder="بحث بالكود أو اسم القائمة…"
        onSearchChange={(v) => {
          setPage(1);
          setSearch(v);
        }}
        exportConfig={{
          fileName: 'price-lists',
          columns: exportColumns as ExportColumnDef<Record<string, unknown>>[],
          rows: rows as Record<string, unknown>[],
        }}
      />
      <AppTable<PriceListRow>
        isLoading={isLoading}
        data={rows}
        getRowKey={(r) => r.id}
        emptyTitle="لا توجد قوائم أسعار"
        columns={[
          { id: 'code', header: 'الكود', cell: (r) => r.code || '—' },
          { id: 'name', header: 'الاسم العربي', accessor: 'arabicName' },
          { id: 'currency', header: 'العملة', cell: (r) => r.currencyCode || '—' },
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
