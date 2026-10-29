'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Plus } from 'lucide-react';
import { AppTable, Button, FilterToolbar, StatusBadge, compactControlClass } from '@/components/ui';
import { formActionButtonClass } from '@/components/ui/forms/formTokens';
import { ReportPageShell } from '@/components/erp';
import { CategorySelect, FA_CRUMB } from '@/components/fixed-assets/shared';
import { useApiQuery } from '@/lib/hooks/useApi';
import { queryKeys } from '@/lib/query/query-keys';
import type { ExportColumnDef } from '@/lib/export/export-utils';
import {
  STATUS_LABELS,
  STATUS_VARIANT,
  formatDay,
  formatMoney,
  type FixedAsset,
  type FixedAssetStatus,
} from '@/lib/fixed-assets/types';

export default function FixedAssetRegisterPage() {
  const router = useRouter();
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<'' | FixedAssetStatus>('');
  const [categoryId, setCategoryId] = useState('');

  const params = useMemo(() => {
    const p: Record<string, string | number> = { page, limit: pageSize };
    if (search.trim()) p.search = search.trim();
    if (status) p.status = status;
    if (categoryId) p.categoryId = categoryId;
    return p;
  }, [page, pageSize, search, status, categoryId]);

  const { data, isLoading } = useApiQuery<FixedAsset[]>(queryKeys.fixedAssets.assets(params), '/fixed-assets/assets', params, {
    staleTime: 0,
  });
  const rows = data?.data ?? [];
  const total = (data as { pagination?: { total?: number } } | undefined)?.pagination?.total ?? rows.length;

  const exportColumns: ExportColumnDef<FixedAsset>[] = [
    { id: 'code', header: 'الكود', getValue: (r) => r.code },
    { id: 'name', header: 'الأصل', getValue: (r) => r.arabicName },
    { id: 'category', header: 'الفئة', getValue: (r) => r.category?.arabicName ?? '' },
    { id: 'status', header: 'الحالة', getValue: (r) => STATUS_LABELS[r.status] },
    { id: 'inService', header: 'تاريخ التشغيل', getValue: (r) => formatDay(r.inServiceDate) },
    { id: 'cost', header: 'التكلفة', getValue: (r) => formatMoney(r.cost) },
    { id: 'acc', header: 'مجمع الإهلاك', getValue: (r) => formatMoney(r.accumulatedDepreciation) },
    { id: 'nbv', header: 'صافي القيمة', getValue: (r) => formatMoney(r.bookValue) },
  ];

  return (
    <ReportPageShell
      title="سجل الأصول الثابتة"
      breadcrumbs={[FA_CRUMB, { label: 'سجل الأصول' }]}
      statusLabel={`${total} أصل`}
      favoriteHref="/fixed-assets/assets"
      extraActions={
        <Button
          type="button"
          variant="primary"
          size="sm"
          className={`${formActionButtonClass} gap-1.5`}
          onClick={() => router.push('/fixed-assets/assets/new')}
        >
          <Plus className="h-3.5 w-3.5" aria-hidden />
          أصل جديد
        </Button>
      }
    >
      <div className="mt-2 space-y-3">
        <FilterToolbar
          searchPlaceholder="بحث بالكود أو الاسم أو الباركود أو الرقم التسلسلي…"
          onSearchChange={(v) => {
            setPage(1);
            setSearch(v);
          }}
          exportConfig={{
            fileName: 'fixed-assets-register',
            columns: exportColumns as unknown as ExportColumnDef<Record<string, unknown>>[],
            rows: rows as unknown as Record<string, unknown>[],
            printTitle: 'سجل الأصول الثابتة',
          }}
        >
          <select
            className={`${compactControlClass} w-40`}
            value={status}
            onChange={(e) => {
              setPage(1);
              setStatus(e.target.value as '' | FixedAssetStatus);
            }}
          >
            <option value="">كل الحالات</option>
            {(Object.keys(STATUS_LABELS) as FixedAssetStatus[]).map((s) => (
              <option key={s} value={s}>
                {STATUS_LABELS[s]}
              </option>
            ))}
          </select>
          <div className="w-52">
            <CategorySelect
              value={categoryId}
              emptyLabel="كل الفئات"
              onChange={(id) => {
                setPage(1);
                setCategoryId(id);
              }}
            />
          </div>
        </FilterToolbar>

        <AppTable<FixedAsset>
          isLoading={isLoading}
          data={rows}
          getRowKey={(r) => r.id}
          onRowClick={(r) => router.push(`/fixed-assets/assets/${r.id}`)}
          emptyTitle="لا توجد أصول"
          emptyDescription="أضف أول أصل، أو غيّر عوامل التصفية."
          columns={[
            { id: 'code', header: 'الكود', accessor: 'code' },
            { id: 'name', header: 'الأصل', accessor: 'arabicName' },
            { id: 'category', header: 'الفئة', cell: (r) => r.category?.arabicName ?? '—' },
            {
              id: 'status',
              header: 'الحالة',
              align: 'center',
              cell: (r) => <StatusBadge compact variant={STATUS_VARIANT[r.status]} label={STATUS_LABELS[r.status]} />,
            },
            { id: 'inService', header: 'تاريخ التشغيل', cell: (r) => formatDay(r.inServiceDate) },
            { id: 'cost', header: 'التكلفة', numeric: true, cell: (r) => formatMoney(r.cost) },
            { id: 'acc', header: 'مجمع الإهلاك', numeric: true, cell: (r) => formatMoney(r.accumulatedDepreciation) },
            { id: 'nbv', header: 'صافي القيمة', numeric: true, cell: (r) => formatMoney(r.bookValue) },
            { id: 'through', header: 'مُهلك حتى', cell: (r) => formatDay(r.depreciatedThrough) },
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
      </div>
    </ReportPageShell>
  );
}
