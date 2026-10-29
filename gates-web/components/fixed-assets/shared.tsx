'use client';

import { useState } from 'react';
import { AppTable, FilterToolbar, StatusBadge, compactControlClass } from '@/components/ui';
import { useApiQuery } from '@/lib/hooks/useApi';
import { queryKeys } from '@/lib/query/query-keys';
import { useBranchesQuery, useCostCentersQuery } from '@/lib/hooks/useMasterDataQueries';
import {
  STATUS_LABELS,
  STATUS_VARIANT,
  formatMoney,
  type FixedAsset,
  type FixedAssetCategory,
  type FixedAssetStatus,
  type JournalPreviewLine,
} from '@/lib/fixed-assets/types';

/** Breadcrumb root for every fixed-assets screen. */
export const FA_CRUMB = { label: 'الأصول الثابتة', href: '/fixed-assets' };

export function useFixedAssetCategories() {
  return useApiQuery<FixedAssetCategory[]>(queryKeys.fixedAssets.categories(), '/fixed-assets/categories', undefined, {
    staleTime: 0,
  });
}

export function CategorySelect({
  value,
  onChange,
  disabled,
  allowEmpty,
  emptyLabel = 'اختر الفئة',
  excludeId,
}: {
  value: string;
  onChange: (id: string, category?: FixedAssetCategory) => void;
  disabled?: boolean;
  allowEmpty?: boolean;
  emptyLabel?: string;
  excludeId?: string;
}) {
  const { data, isLoading } = useFixedAssetCategories();
  const rows = (data?.data ?? []).filter((c) => c.id !== excludeId);
  return (
    <select
      className={compactControlClass}
      value={value}
      disabled={disabled || isLoading}
      onChange={(e) => onChange(e.target.value, rows.find((c) => c.id === e.target.value))}
    >
      {allowEmpty !== false ? <option value="">{emptyLabel}</option> : null}
      {rows.map((c) => (
        <option key={c.id} value={c.id}>
          {c.code} - {c.arabicName}
        </option>
      ))}
    </select>
  );
}

export function BranchSelect({ value, onChange, disabled }: { value: string; onChange: (id: string) => void; disabled?: boolean }) {
  const { data } = useBranchesQuery(100);
  const branches = (data?.data ?? []) as Array<{ id: string; arabicName?: string; name?: string }>;
  return (
    <select className={compactControlClass} value={value} disabled={disabled} onChange={(e) => onChange(e.target.value)}>
      <option value="">—</option>
      {branches.map((b) => (
        <option key={b.id} value={b.id}>
          {b.arabicName ?? b.name ?? b.id}
        </option>
      ))}
    </select>
  );
}

export function CostCenterSelect({ value, onChange, disabled }: { value: string; onChange: (id: string) => void; disabled?: boolean }) {
  const { data } = useCostCentersQuery(500, { leafOnly: true });
  return (
    <select className={compactControlClass} value={value} disabled={disabled} onChange={(e) => onChange(e.target.value)}>
      <option value="">—</option>
      {(data?.data ?? []).map((c) => (
        <option key={c.id} value={c.id}>
          {c.code ? `${c.code} - ` : ''}
          {c.arabicName}
        </option>
      ))}
    </select>
  );
}

/** Preview of the entry a post will create — same look as the journal tab of posted documents. */
export function JournalPreviewTable({ lines, emptyTitle }: { lines: JournalPreviewLine[]; emptyTitle?: string }) {
  if (!lines.length) {
    return <p className="py-6 text-center text-xs text-slate-500">{emptyTitle ?? 'احسب أولًا لعرض القيد'}</p>;
  }
  const totalDebit = lines.reduce((s, l) => s + Number(l.debit || 0), 0);
  const totalCredit = lines.reduce((s, l) => s + Number(l.credit || 0), 0);
  return (
    <table className="w-full min-w-[520px] text-xs">
      <thead className="bg-[#F6FBFD] text-[#094C6B]">
        <tr>
          <th className="p-2 text-start font-semibold">الحساب</th>
          <th className="p-2 text-start font-semibold">البيان</th>
          <th className="p-2 text-end font-semibold">مدين</th>
          <th className="p-2 text-end font-semibold">دائن</th>
        </tr>
      </thead>
      <tbody>
        {lines.map((l, i) => (
          <tr key={`${l.accountId}-${i}`} className="border-t border-[#E8F1F6]">
            <td className="p-2 font-medium text-[#0A3D5E]">
              {l.accountCode ? `${l.accountCode} - ` : ''}
              {l.accountName || l.accountId}
            </td>
            <td className="p-2 text-slate-500">{l.description ?? ''}</td>
            <td className="p-2 text-end tabular-nums">{l.debit ? formatMoney(l.debit) : ''}</td>
            <td className="p-2 text-end tabular-nums">{l.credit ? formatMoney(l.credit) : ''}</td>
          </tr>
        ))}
      </tbody>
      <tfoot className="border-t border-[#D6EAF3] font-bold text-[#094C6B]">
        <tr>
          <td className="p-2" colSpan={2}>
            الإجمالي
          </td>
          <td className="p-2 text-end tabular-nums">{formatMoney(totalDebit)}</td>
          <td className="p-2 text-end tabular-nums">{formatMoney(totalCredit)}</td>
        </tr>
      </tfoot>
    </table>
  );
}

/** «السابق» list of assets — server-side search, opens the card on the same page. */
export function AssetBrowseList({
  onSelect,
  selectedId,
  onlyInService,
}: {
  onSelect: (asset: FixedAsset) => void;
  selectedId?: string | null;
  onlyInService?: boolean;
}) {
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<'' | FixedAssetStatus>('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const params: Record<string, string | number> = { page, limit: pageSize };
  if (search.trim()) params.search = search.trim();
  if (status) params.status = status;
  const { data, isLoading } = useApiQuery<FixedAsset[]>(
    queryKeys.fixedAssets.assets({ browse: true, ...params }),
    '/fixed-assets/assets',
    params,
    { staleTime: 0 }
  );
  const all = data?.data ?? [];
  const rows = onlyInService ? all.filter((a) => a.status === 'ACTIVE' || a.status === 'FULLY_DEPRECIATED') : all;
  const total = (data as { pagination?: { total?: number } } | undefined)?.pagination?.total ?? rows.length;

  return (
    <div className="space-y-3">
      <FilterToolbar
        searchPlaceholder="بحث بالكود أو الاسم أو الباركود…"
        onSearchChange={(v) => {
          setPage(1);
          setSearch(v);
        }}
      >
        {onlyInService ? null : (
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
        )}
      </FilterToolbar>
      <AppTable<FixedAsset>
        isLoading={isLoading}
        data={rows}
        getRowKey={(r) => r.id}
        emptyTitle="لا توجد أصول"
        onRowClick={onSelect}
        rowClassName={(r) => (selectedId === r.id ? 'bg-sky-50 even:bg-sky-50 hover:bg-sky-100' : undefined)}
        columns={[
          { id: 'code', header: 'الكود', accessor: 'code' },
          { id: 'name', header: 'الأصل', accessor: 'arabicName' },
          { id: 'nbv', header: 'صافي القيمة', numeric: true, cell: (r) => formatMoney(r.bookValue) },
          {
            id: 'status',
            header: 'الحالة',
            cell: (r) => <StatusBadge compact variant={STATUS_VARIANT[r.status]} label={STATUS_LABELS[r.status]} />,
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
    </div>
  );
}
