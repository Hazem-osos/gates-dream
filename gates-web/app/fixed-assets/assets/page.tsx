'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AppTable, Button, FilterToolbar, StatusBadge } from '@/app/components/ui';
import { compactControlClass } from '@/components/ui/forms/formTokens';
import { CategorySelect, FixedAssetsPage } from '@/components/fixed-assets/shared';
import { useApiQuery } from '@/lib/hooks/useApi';
import { queryKeys } from '@/lib/query/query-keys';
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

  return (
    <FixedAssetsPage
      title="سجل الأصول"
      actions={<Button onClick={() => router.push('/fixed-assets/assets/new')}>+ إضافة أصل</Button>}
    >
      <div className="flex flex-wrap items-end gap-2">
        <div className="min-w-[16rem] flex-1">
          <FilterToolbar
            searchPlaceholder="بحث بالكود أو الاسم أو الباركود أو الرقم التسلسلي…"
            onSearchChange={(v) => {
              setPage(1);
              setSearch(v);
            }}
          />
        </div>
        <select
          className={`${compactControlClass} w-44`}
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
        <div className="w-56">
          <CategorySelect
            value={categoryId}
            emptyLabel="كل الفئات"
            onChange={(id) => {
              setPage(1);
              setCategoryId(id);
            }}
          />
        </div>
      </div>

      <AppTable<FixedAsset>
        isLoading={isLoading}
        data={rows}
        getRowKey={(r) => r.id}
        onRowClick={(r) => router.push(`/fixed-assets/assets/${r.id}`)}
        emptyTitle="لا توجد أصول"
        emptyDescription="أضف أول أصل، أو غيّر عوامل التصفية."
        exportFileName="fixed-assets-register"
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
    </FixedAssetsPage>
  );
}
