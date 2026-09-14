'use client';

import { useMemo, useState } from 'react';
import { AppTable, FilterToolbar, Button, StatusBadge } from '@/components/ui';
import { useApiQuery } from '@/lib/hooks/useApi';
import type { ExportColumnDef } from '@/lib/export/export-utils';

export type CurrencyRow = {
  id: string;
  code: string;
  arabicName: string;
  englishName?: string | null;
  exchangeRate?: number | string | null;
  isActive?: boolean;
};

export function CurrenciesListSection({
  onSelect,
  onDelete,
  selectedId,
}: {
  onSelect?: (row: CurrencyRow) => void;
  onDelete?: (row: CurrencyRow) => void;
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

  const { data, isLoading } = useApiQuery<CurrencyRow[]>(
    ['currencies', { page, search, pageSize }],
    '/accounting/currencies',
    queryParams,
    { staleTime: 15_000 }
  );

  const rows = useMemo(() => data?.data ?? [], [data?.data]);
  const total = data?.pagination?.total ?? data?.meta?.total ?? rows.length;

  const exportColumns: ExportColumnDef<CurrencyRow>[] = [
    { id: 'code', header: 'الرمز', accessor: 'code' },
    { id: 'arabicName', header: 'الاسم العربي', accessor: 'arabicName' },
    { id: 'englishName', header: 'الاسم الإنجليزي', getValue: (r) => r.englishName || '' },
    { id: 'rate', header: 'سعر الصرف', getValue: (r) => String(r.exchangeRate ?? '') },
  ];

  return (
    <section className="space-y-4">
      <FilterToolbar
        searchPlaceholder="بحث بالرمز أو اسم العملة…"
        onSearchChange={(v) => {
          setPage(1);
          setSearch(v);
        }}
        exportConfig={{
          fileName: 'currencies',
          columns: exportColumns as ExportColumnDef<Record<string, unknown>>[],
          rows: rows as Record<string, unknown>[],
        }}
      />
      <AppTable<CurrencyRow>
        isLoading={isLoading}
        data={rows}
        getRowKey={(r) => r.id}
        emptyTitle="لا توجد عملات"
        emptyDescription="أضف عملة جديدة من قائمة الإجراءات."
        columns={[
          { id: 'code', header: 'الرمز', accessor: 'code' },
          { id: 'arabicName', header: 'الاسم العربي', accessor: 'arabicName' },
          { id: 'englishName', header: 'الإنجليزي', cell: (r) => r.englishName || '—' },
          {
            id: 'rate',
            header: 'سعر الصرف',
            cell: (r) => (r.exchangeRate != null && r.exchangeRate !== '' ? String(r.exchangeRate) : '—'),
          },
          {
            id: 'status',
            header: 'الحالة',
            align: 'center',
            cell: (r) => (
              <StatusBadge
                compact
                variant={r.isActive === false ? 'danger' : 'success'}
                label={r.isActive === false ? 'غير نشطة' : 'نشطة'}
              />
            ),
          },
          {
            id: 'actions',
            header: '',
            align: 'center',
            cell: (r) => (
              <div className="flex items-center justify-center gap-1">
                <Button
                  variant={selectedId === r.id ? 'primary' : 'ghost'}
                  size="sm"
                  onClick={() => onSelect?.(r)}
                >
                  فتح
                </Button>
                {onDelete ? (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-red-600 hover:bg-red-50 hover:text-red-700"
                    onClick={() => onDelete(r)}
                  >
                    حذف
                  </Button>
                ) : null}
              </div>
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
