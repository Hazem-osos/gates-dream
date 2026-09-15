'use client';

import { useMemo, useState } from 'react';
import { AppTable, FilterToolbar, StatusBadge } from '@/components/ui';
import { useApiQuery } from '@/lib/hooks/useApi';
import type { ExportColumnDef } from '@/lib/export/export-utils';

export type PartyRow = {
  id: string;
  code?: string | null;
  serial?: string | null;
  arabicName: string;
  phone1?: string | null;
  city?: string | null;
  balance?: number | string | null;
  isActive?: boolean;
  [key: string]: unknown;
};

type Props = {
  endpoint: '/accounting/customers' | '/accounting/suppliers';
  queryKeyPrefix: 'customers' | 'suppliers';
  emptyTitle: string;
  onSelect?: (id: string) => void;
  onRowActivate?: (row: PartyRow) => void;
  selectedRowId?: string | null;
};

export function PartiesListSection({ endpoint, queryKeyPrefix, emptyTitle, onSelect, onRowActivate, selectedRowId }: Props) {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(15);
  const [search, setSearch] = useState('');

  const queryParams = useMemo(() => {
    const p: Record<string, string | number | boolean> = { page, limit: pageSize, isActive: true };
    if (search.trim().length >= 2) p.search = search.trim();
    return p;
  }, [page, pageSize, search]);

  const { data, isLoading } = useApiQuery<PartyRow[]>(
    [queryKeyPrefix, { page, search }],
    endpoint,
    queryParams,
    { staleTime: 30_000 }
  );

  const rows = data?.data ?? [];
  const total = data?.pagination?.total ?? data?.meta?.total ?? rows.length;

  const exportColumns: ExportColumnDef<PartyRow>[] = [
    { id: 'code', header: 'الكود', getValue: (r) => r.code || r.serial || '' },
    { id: 'name', header: 'الاسم', accessor: 'arabicName' },
    { id: 'phone', header: 'الهاتف', accessor: 'phone1' },
    { id: 'city', header: 'المدينة', accessor: 'city' },
    {
      id: 'status',
      header: 'الحالة',
      getValue: (r) => (r.isActive !== false ? 'نشط' : 'موقوف'),
    },
  ];

  return (
    <section className="mb-8 space-y-4">
      <FilterToolbar
        searchPlaceholder="بحث بالكود أو الاسم…"
        onSearchChange={(v) => {
          setPage(1);
          setSearch(v);
        }}
        exportConfig={{
          fileName: queryKeyPrefix,
          columns: exportColumns as ExportColumnDef<Record<string, unknown>>[],
          rows: rows as Record<string, unknown>[],
        }}
      />
      <AppTable<PartyRow>
        isLoading={isLoading}
        data={rows}
        getRowKey={(r) => r.id}
        onRowClick={(row) => {
          onRowActivate?.(row);
          onSelect?.(row.id);
        }}
        emptyTitle={emptyTitle}
        emptyDescription="غيّر البحث أو أضف سجلاً جديداً من النموذج."
        columns={[
          { id: 'code', header: 'الكود', cell: (r) => r.code || r.serial || '—' },
          { id: 'name', header: 'الاسم', cell: (r) => (
            <button
              type="button"
              className={`text-right w-full hover:text-[#0E79AA] ${selectedRowId === r.id ? 'font-bold text-[#0E79AA]' : ''}`}
              onClick={() => {
                onRowActivate?.(r);
                onSelect?.(r.id);
              }}
            >
              {r.arabicName}
            </button>
          ) },
          { id: 'phone', header: 'الهاتف', cell: (r) => r.phone1 || '—' },
          { id: 'city', header: 'المدينة', cell: (r) => r.city || '—' },
          {
            id: 'balance',
            header: 'الرصيد',
            align: 'end',
            numeric: true,
            cell: (r) => (r.balance != null ? Number(r.balance).toLocaleString('ar-EG') : '—'),
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
