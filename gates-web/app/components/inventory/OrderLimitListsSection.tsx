'use client';

import { useMemo, useState } from 'react';
import { AppTable, FilterToolbar, Button } from '@/components/ui';
import { useApiQuery } from '@/lib/hooks/useApi';
import { queryKeys } from '@/lib/query/query-keys';
import type { ExportColumnDef } from '@/lib/export/export-utils';

export type OrderLimitListRow = {
  id: string;
  code?: string | null;
  warehouseId: string;
  description?: string | null;
  warehouse?: { arabicName?: string; code?: string | null } | null;
  _count?: { lines?: number };
};

export function OrderLimitListsSection({
  onSelect,
  selectedId,
}: {
  onSelect?: (row: OrderLimitListRow) => void;
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
    if (search.trim().length >= 2) p.search = search.trim();
    return p;
  }, [page, pageSize, search]);

  const { data, isLoading } = useApiQuery<OrderLimitListRow[]>(
    queryKeys.itemOrderLimits({ page, search }),
    '/inventory/item-order-limits',
    queryParams,
    { staleTime: 15_000 }
  );

  const rows = data?.data ?? [];
  const total = data?.pagination?.total ?? data?.meta?.total ?? rows.length;

  const exportColumns: ExportColumnDef<OrderLimitListRow>[] = [
    { id: 'code', header: 'الكود', getValue: (r) => r.code || '' },
    { id: 'warehouse', header: 'المخزن', getValue: (r) => r.warehouse?.arabicName || '' },
    { id: 'description', header: 'الوصف', getValue: (r) => r.description || '' },
  ];

  return (
    <section className="mb-6 space-y-4">
      <FilterToolbar
        searchPlaceholder="بحث بالكود أو الوصف…"
        onSearchChange={(v) => {
          setPage(1);
          setSearch(v);
        }}
        exportConfig={{
          fileName: 'item-order-limits',
          columns: exportColumns as ExportColumnDef<Record<string, unknown>>[],
          rows: rows as Record<string, unknown>[],
        }}
      />
      <AppTable<OrderLimitListRow>
        isLoading={isLoading}
        data={rows}
        getRowKey={(r) => r.id}
        emptyTitle="لا توجد بطاقات حد طلب"
        columns={[
          { id: 'code', header: 'الكود', cell: (r) => r.code || '—' },
          {
            id: 'warehouse',
            header: 'المخزن',
            cell: (r) => r.warehouse?.arabicName || '—',
          },
          {
            id: 'count',
            header: 'الأصناف',
            align: 'center',
            cell: (r) => r._count?.lines ?? 0,
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
