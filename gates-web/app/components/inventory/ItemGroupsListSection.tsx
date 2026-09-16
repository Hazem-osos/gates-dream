'use client';

import { useMemo, useState } from 'react';
import { AppTable, FilterToolbar, StatusBadge, Button } from '@/components/ui';
import { useApiQuery } from '@/lib/hooks/useApi';
import { queryKeys } from '@/lib/query/query-keys';
import type { ExportColumnDef } from '@/lib/export/export-utils';

export type ItemGroupRow = {
  id: string;
  code?: string | null;
  arabicName: string;
  englishName?: string | null;
  groupType?: string | null;
  parentCategoryId?: string | null;
  isFeatured?: boolean;
  isTaxExempt?: boolean;
  taxRate?: number | string | null;
  isActive?: boolean;
  [key: string]: unknown;
};

export function ItemGroupsListSection({
  onSelect,
  selectedId,
}: {
  onSelect?: (row: ItemGroupRow) => void;
  selectedId?: string | null;
}) {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [search, setSearch] = useState('');

  const queryParams = useMemo(() => {
    const p: Record<string, string | number | boolean> = { page, limit: pageSize };
    if (search.trim()) p.search = search.trim();
    return p;
  }, [page, pageSize, search]);

  const { data, isLoading } = useApiQuery<ItemGroupRow[]>(
    queryKeys.itemCategories({ page, search }),
    '/inventory/item-categories',
    queryParams,
    { staleTime: 30_000 }
  );

  const rows = data?.data ?? [];
  const total = data?.pagination?.total ?? data?.meta?.total ?? rows.length;

  const exportColumns: ExportColumnDef<ItemGroupRow>[] = [
    { id: 'code', header: 'الرقم', getValue: (r) => r.code || '' },
    { id: 'name', header: 'اسم المجموعة', accessor: 'arabicName' },
    {
      id: 'type',
      header: 'النوع',
      getValue: (r) => (r.groupType === 'SUB' ? 'فرعية' : 'رئيسية'),
    },
  ];

  return (
    <section className="mb-8 space-y-4">
      <FilterToolbar
        searchPlaceholder="بحث برقم أو اسم المجموعة…"
        onSearchChange={(v) => {
          setPage(1);
          setSearch(v);
        }}
        exportConfig={{
          fileName: 'item-groups',
          columns: exportColumns as ExportColumnDef<Record<string, unknown>>[],
          rows: rows as Record<string, unknown>[],
        }}
      />

      <AppTable<ItemGroupRow>
        isLoading={isLoading}
        data={rows}
        getRowKey={(r) => r.id}
        emptyTitle="لا توجد مجموعات أصناف"
        columns={[
          { id: 'code', header: 'الرقم', cell: (r) => r.code || '—' },
          { id: 'name', header: 'اسم المجموعة', accessor: 'arabicName' },
          {
            id: 'type',
            header: 'النوع',
            cell: (r) => (r.groupType === 'SUB' ? 'فرعية' : 'رئيسية'),
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
