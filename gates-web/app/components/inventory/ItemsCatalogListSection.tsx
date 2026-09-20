'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AppTable, FilterToolbar, StatusBadge, Button } from '@/components/ui';
import { useApiQuery } from '@/lib/hooks/useApi';
import { queryKeys } from '@/lib/query/query-keys';
import type { ExportColumnDef } from '@/lib/export/export-utils';
import dynamic from 'next/dynamic';
import { DynamicModalSkeleton } from '@/components/ui/DynamicChunkSkeleton';

const BarcodePrintModal = dynamic(
  () =>
    import('@/app/components/print/BarcodePrintModal').then((m) => ({
      default: m.BarcodePrintModal,
    })),
  { ssr: false, loading: () => <DynamicModalSkeleton label="جاري تحميل طباعة الباركود…" /> }
);

export type ItemRow = {
  id: string;
  code?: string | null;
  serial?: string | null;
  arabicName: string;
  englishName?: string | null;
  itemType?: string | null;
  categoryId?: string | null;
  isActive?: boolean;
  [key: string]: unknown;
};

export function ItemsCatalogListSection({
  onSelectItem,
  initialSearch = '',
}: {
  onSelectItem?: (id: string) => void;
  initialSearch?: string;
}) {
  const router = useRouter();
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [search, setSearch] = useState(initialSearch);
  const [itemType, setItemType] = useState('');
  const [barcodeOpen, setBarcodeOpen] = useState(false);

  const filterKey = useMemo(() => ({ search, itemType }), [search, itemType]);

  const queryParams = useMemo(() => {
    const p: Record<string, string | number | boolean> = { page, limit: pageSize };
    if (search.trim()) p.search = search.trim();
    if (itemType) p.itemType = itemType;
    return p;
  }, [page, pageSize, search, itemType]);

  const { data, isLoading } = useApiQuery<ItemRow[]>(
    queryKeys.items({ page, ...filterKey }),
    '/inventory/items',
    queryParams,
    { staleTime: 30_000 }
  );

  const rows = data?.data ?? [];
  const total = data?.pagination?.total ?? data?.meta?.total ?? rows.length;

  const exportColumns: ExportColumnDef<ItemRow>[] = [
    { id: 'code', header: 'الكود', getValue: (r) => r.code || r.serial || '' },
    { id: 'name', header: 'الاسم', accessor: 'arabicName' },
    { id: 'type', header: 'النوع', getValue: (r) => r.itemType || '' },
    {
      id: 'status',
      header: 'الحالة',
      getValue: (r) => (r.isActive !== false ? 'نشط' : 'موقوف'),
    },
  ];

  return (
    <section className="mb-8 space-y-4">
      <div data-tour="item-search-card">
      <FilterToolbar
        searchPlaceholder="بحث بالكود أو اسم الصنف…"
        onSearchChange={(v) => {
          setPage(1);
          setSearch(v);
        }}
        exportConfig={{
          fileName: 'items-catalog',
          columns: exportColumns as ExportColumnDef<Record<string, unknown>>[],
          rows: rows as Record<string, unknown>[],
          printTitle: 'دليل الأصناف',
        }}
      >
        <Button
          type="button"
          variant="primary"
          size="sm"
          onClick={() => router.push('/inventory/creations/item-card')}
        >
          صنف جديد
        </Button>
        <Button type="button" variant="secondary" size="sm" onClick={() => setBarcodeOpen(true)}>
          طباعة باركود
        </Button>
        <select
          value={itemType}
          onChange={(e) => {
            setPage(1);
            setItemType(e.target.value);
          }}
          className="rounded-lg border border-[#D6EAF3] bg-white px-3 py-2 text-sm"
        >
          <option value="">كل الأنواع</option>
          <option value="normal">عادي</option>
          <option value="pack-sheet">بالشيت</option>
          <option value="pack-kilo">بالكيلو</option>
          <option value="roll">رول</option>
        </select>
      </FilterToolbar>
      </div>

      <AppTable<ItemRow>
        isLoading={isLoading}
        data={rows}
        getRowKey={(r) => r.id}
        emptyTitle="لا توجد أصناف"
        emptyDescription="أنشئ صنفاً جديداً أو غيّر عوامل البحث."
        columns={[
          {
            id: 'code',
            header: 'الكود',
            cell: (r) => r.code || r.serial || '—',
          },
          { id: 'name', header: 'الاسم', accessor: 'arabicName' },
          { id: 'type', header: 'النوع', cell: (r) => r.itemType || '—' },
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
                variant="secondary"
                size="sm"
                onClick={() => {
                  onSelectItem?.(r.id);
                  router.push(`/inventory/creations/item-card?id=${r.id}`);
                }}
              >
                فتح
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
      {barcodeOpen ? (
        <BarcodePrintModal open onClose={() => setBarcodeOpen(false)} />
      ) : null}
    </section>
  );
}
