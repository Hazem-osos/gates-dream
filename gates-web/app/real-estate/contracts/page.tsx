'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { PageHeader } from '@/components/ui/PageHeader';
import { EmptyState } from '@/components/ui/EmptyState';
import { TableSkeleton } from '@/components/ui/TableSkeleton';
import { FilterToolbar } from '@/components/ui/FilterToolbar';
import { compactControlClass } from '@/components/ui';
import {
  denseTableWrapClass,
  denseTableClass,
  denseTheadClass,
  denseThClass,
  denseTdClass,
  denseTrClass,
} from '@/components/ui';
import { RealEstatePageShell, ReCard } from '@/components/real-estate/RealEstatePageShell';
import { ContractStatusBadge, ResaleLockBadge } from '@/components/real-estate/StatusBadges';
import { useApiQuery } from '@/lib/hooks/useApi';
import { queryKeys, staleTimes } from '@/lib/query/query-keys';
import { formatDateAr, formatEgp } from '@/lib/real-estate/format';
import type { UnitContractListItem, UnitContractStatus } from '@/lib/real-estate/types';

const STATUS_OPTIONS: Array<{ value: '' | UnitContractStatus; label: string }> = [
  { value: '', label: 'كل الحالات' },
  { value: 'ACTIVE', label: 'ساري' },
  { value: 'RESALE_IN_PROGRESS', label: 'إعادة بيع' },
  { value: 'TRANSFERRED', label: 'محوّل' },
  { value: 'COMPLETED', label: 'مكتمل' },
  { value: 'TERMINATED', label: 'ملغى' },
  { value: 'TERMINATED_FORFEITED', label: 'فسخ ومصادرة' },
];

export default function RealEstateContractsPage() {
  const { data, isLoading, isError } = useApiQuery<UnitContractListItem[]>(
    queryKeys.realEstate.contracts(),
    '/real-estate/contracts',
    { limit: 200 },
    { staleTime: staleTimes.transactionalMs, refetchOnWindowFocus: true }
  );
  const rows = useMemo(() => data?.data ?? [], [data?.data]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'' | UnitContractStatus>('');

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((row) => {
      if (statusFilter && row.status !== statusFilter) return false;
      if (!q) return true;
      const haystack = [
        row.contractNumber,
        row.unit?.unitCode,
        row.customer?.arabicName,
        row.customer?.code,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [rows, search, statusFilter]);

  return (
    <RealEstatePageShell>
      <PageHeader
        title="عقود الوحدات"
        breadcrumbs={[{ label: 'العقاري', href: '/real-estate' }, { label: 'العقود' }]}
      />
      <ReCard>
        <FilterToolbar
          searchPlaceholder="بحث برقم العقد أو الوحدة أو العميل…"
          onSearchChange={setSearch}
          className="mb-4"
        >
          <select
            className={`${compactControlClass} w-auto min-w-[10rem]`}
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as '' | UnitContractStatus)}
          >
            {STATUS_OPTIONS.map((opt) => (
              <option key={opt.value || 'all'} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </FilterToolbar>

        {isLoading ? (
          <TableSkeleton columns={6} rows={8} />
        ) : isError ? (
          <EmptyState title="تعذر تحميل العقود" />
        ) : rows.length === 0 ? (
          <EmptyState title="لا توجد عقود" description="أنشئ عقد بيع وحدة من مسار الوحدات الحالي ثم عد هنا لإدارة الأقساط." />
        ) : filtered.length === 0 ? (
          <EmptyState title="لا توجد نتائج" description="عدّل البحث أو حالة العقد." />
        ) : (
          <div className={denseTableWrapClass}>
            <table className={denseTableClass}>
              <thead>
                <tr className={denseTheadClass}>
                  <th className={denseThClass}>رقم العقد</th>
                  <th className={denseThClass}>الوحدة</th>
                  <th className={denseThClass}>المشتري</th>
                  <th className={denseThClass}>سعر البيع</th>
                  <th className={denseThClass}>الأقساط</th>
                  <th className={denseThClass}>الحالة</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((row) => (
                  <tr key={row.id} className={denseTrClass}>
                    <td className={denseTdClass}>
                      <Link href={`/real-estate/contracts/${row.id}`} className="font-semibold text-[#0E79AA] underline">
                        {row.contractNumber}
                      </Link>
                      <div className="text-xs text-slate-500">{formatDateAr(row.contractDate)}</div>
                    </td>
                    <td className={denseTdClass}>{row.unit?.unitCode ?? '—'}</td>
                    <td className={denseTdClass}>{row.customer?.arabicName ?? '—'}</td>
                    <td className={`${denseTdClass} tabular-nums`}>
                      {formatEgp(row.totalSellingPrice || row.totalContractAmount)}
                    </td>
                    <td className={denseTdClass}>{row._count?.installments ?? '—'}</td>
                    <td className={`${denseTdClass} space-y-1`}>
                      <ContractStatusBadge status={row.status} />
                      {row.resaleLock ? (
                        <div className="mt-1 flex justify-end">
                          <ResaleLockBadge locked />
                        </div>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </ReCard>
    </RealEstatePageShell>
  );
}
