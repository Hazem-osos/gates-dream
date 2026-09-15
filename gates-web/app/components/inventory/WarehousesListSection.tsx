'use client';

import { useMemo, useState } from 'react';
import { AppTable, FilterToolbar, StatusBadge, Button } from '@/components/ui';
import { useApiQuery } from '@/lib/hooks/useApi';
import { queryKeys } from '@/lib/query/query-keys';
import type { ExportColumnDef } from '@/lib/export/export-utils';

export function asWarehouseRows(data: unknown): WarehouseRow[] {
  if (Array.isArray(data)) return data as WarehouseRow[];
  if (data && typeof data === 'object') {
    const nested = (data as { warehouses?: unknown; data?: unknown }).warehouses
      ?? (data as { data?: unknown }).data;
    if (Array.isArray(nested)) return nested as WarehouseRow[];
  }
  return [];
}

export type WarehouseRow = {
  id: string;
  code?: string | null;
  arabicName: string;
  englishName?: string | null;
  storeType?: string | null;
  parentWarehouseId?: string | null;
  inventoryAccountId?: string | null;
  costAccountId?: string | null;
  giftAccountId?: string | null;
  address?: string | null;
  keeperName?: string | null;
  isActive?: boolean;
  [key: string]: unknown;
};

export function WarehousesListSection({
  onSelect,
  selectedId,
}: {
  onSelect?: (row: WarehouseRow) => void;
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

  const { data, isLoading } = useApiQuery<WarehouseRow[]>(
    queryKeys.warehouses({ page, search }),
    '/inventory/warehouses',
    queryParams,
    { staleTime: 30_000 }
  );

  const rows = asWarehouseRows(data?.data);
  const total = data?.pagination?.total ?? data?.meta?.total ?? rows.length;

  const exportColumns: ExportColumnDef<WarehouseRow>[] = [
    { id: 'code', header: 'الرقم', getValue: (r) => r.code || '' },
    { id: 'name', header: 'اسم المخزن', accessor: 'arabicName' },
    {
      id: 'status',
      header: 'الحالة',
      getValue: (r) => (r.isActive !== false ? 'نشط' : 'موقوف'),
    },
  ];

  return (
    <section className="mb-8 space-y-4">
      <FilterToolbar
        searchPlaceholder="بحث برقم أو اسم المخزن…"
        onSearchChange={(v) => {
          setPage(1);
          setSearch(v);
        }}
        exportConfig={{
          fileName: 'warehouses',
          columns: exportColumns as ExportColumnDef<Record<string, unknown>>[],
          rows: rows as Record<string, unknown>[],
        }}
      />

      <AppTable<WarehouseRow>
        isLoading={isLoading}
        data={rows}
        getRowKey={(r) => r.id}
        onRowClick={onSelect}
        emptyTitle="لا توجد مخازن"
        columns={[
          { id: 'code', header: 'المسلسل', cell: (r) => r.code || '—', sortValue: (r) => r.code || '' },
          { id: 'name', header: 'اسم المخزن', accessor: 'arabicName' },
          {
            id: 'type',
            header: 'النوع',
            cell: (r) => (r.storeType === 'SUB' ? 'فرعي' : 'رئيسي'),
            sortValue: (r) => r.storeType || 'MAIN',
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
            sortValue: (r) => (r.isActive !== false ? 1 : 0),
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
