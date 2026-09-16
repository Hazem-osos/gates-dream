'use client';

import { useMemo, useState } from 'react';
import { AppTable, FilterToolbar, Button } from '@/components/ui';
import { useApiQuery } from '@/lib/hooks/useApi';
import { queryKeys } from '@/lib/query/query-keys';
import type { ExportColumnDef } from '@/lib/export/export-utils';

export type CustomerContractRow = {
  id: string;
  code?: string | null;
  customerId: string;
  contractType?: string | null;
  cashPercentage?: number | string | null;
  creditPercentage?: number | string | null;
  daysCount?: number | null;
  customer?: { id?: string; code?: string | null; arabicName?: string } | null;
  _count?: { groups?: number };
};

export function CustomerContractsListSection({
  onSelect,
  selectedId,
}: {
  onSelect?: (row: CustomerContractRow) => void;
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

  const { data, isLoading } = useApiQuery<CustomerContractRow[]>(
    queryKeys.customerContracts({ page, search }),
    '/inventory/customer-contracts',
    queryParams,
    { staleTime: 15_000 }
  );

  const rows = data?.data ?? [];
  const total = data?.pagination?.total ?? data?.meta?.total ?? rows.length;

  const exportColumns: ExportColumnDef<CustomerContractRow>[] = [
    { id: 'code', header: 'الكود', getValue: (r) => r.code || '' },
    { id: 'customer', header: 'العميل', getValue: (r) => r.customer?.arabicName || '' },
    { id: 'type', header: 'النوع', getValue: (r) => r.contractType || '' },
  ];

  return (
    <section className="mb-6 space-y-4">
      <FilterToolbar
        searchPlaceholder="بحث بالكود أو اسم العميل…"
        onSearchChange={(v) => {
          setPage(1);
          setSearch(v);
        }}
        exportConfig={{
          fileName: 'customer-contracts',
          columns: exportColumns as ExportColumnDef<Record<string, unknown>>[],
          rows: rows as Record<string, unknown>[],
        }}
      />
      <AppTable<CustomerContractRow>
        isLoading={isLoading}
        data={rows}
        getRowKey={(r) => r.id}
        emptyTitle="لا توجد تعاقدات"
        columns={[
          { id: 'code', header: 'الكود', cell: (r) => r.code || '—' },
          { id: 'customer', header: 'العميل', cell: (r) => r.customer?.arabicName || '—' },
          { id: 'type', header: 'النوع', cell: (r) => r.contractType || '—' },
          {
            id: 'days',
            header: 'الأيام',
            align: 'center',
            cell: (r) => r.daysCount ?? '—',
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
