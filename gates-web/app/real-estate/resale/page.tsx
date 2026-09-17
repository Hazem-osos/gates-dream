'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/EmptyState';
import { RealEstatePageShell, ReCard, RealEstateWorkspaceHeader } from '@/components/real-estate/RealEstatePageShell';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { TableSkeleton } from '@/components/ui/TableSkeleton';
import { ResaleLockBadge } from '@/components/real-estate/StatusBadges';
import { useApiQuery, useInvalidateQuery } from '@/lib/hooks/useApi';
import { queryKeys, staleTimes } from '@/lib/query/query-keys';
import { formatEgp, rateToPercent } from '@/lib/real-estate/format';
import type { UnitContractListItem, UnitResaleTransfer } from '@/lib/real-estate/types';
import { lazyNamedModal } from '@/components/ui/lazyModal';

const RequestResaleModal = lazyNamedModal(
  () => import('@/components/real-estate/RequestResaleModal'),
  'RequestResaleModal',
  'جاري تحميل طلب إعادة البيع…'
);
const ClearResaleModal = lazyNamedModal(
  () => import('@/components/real-estate/ClearResaleModal'),
  'ClearResaleModal',
  'جاري تحميل تسوية إعادة البيع…'
);

export default function ResalePage() {
  const invalidate = useInvalidateQuery();
  const [requestOpen, setRequestOpen] = useState(false);
  const [clearRow, setClearRow] = useState<UnitResaleTransfer | null>(null);

  const { data, isLoading, isError } = useApiQuery<UnitResaleTransfer[]>(
    queryKeys.realEstate.resale(),
    '/real-estate/resale',
    undefined,
    { staleTime: staleTimes.transactionalMs, refetchOnWindowFocus: true }
  );
  const contractsQ = useApiQuery<UnitContractListItem[]>(queryKeys.realEstate.contracts(), '/real-estate/contracts', { limit: 200 });
  const rows = data?.data ?? [];
  const refresh = () => {
    invalidate(queryKeys.realEstate.resale());
    invalidate(queryKeys.realEstate.contracts());
  };

  return (
    <RealEstatePageShell>
      <RealEstateWorkspaceHeader
        title="إعادة البيع ورسوم التنازل"
        breadcrumbs={[
          { label: 'الاستثمار العقاري', href: '/real-estate-investment' },
          { label: 'إعادة البيع' },
        ]}
        favoriteHref="/real-estate/resale"
        extraActions={<Button onClick={() => setRequestOpen(true)}>طلب إعادة بيع</Button>}
      />
      <ReCard>
        {isLoading ? (
          <TableSkeleton columns={6} rows={6} />
        ) : isError ? (
          <EmptyState title="تعذر تحميل طلبات إعادة البيع" />
        ) : rows.length === 0 ? (
          <EmptyState title="لا توجد طلبات تنازل" description="ابدأ بطلب إعادة بيع من عقد ساري." />
        ) : (
          <div className="overflow-x-auto rounded-xl border border-[#E6F0F7]">
            <table className="w-full min-w-[900px] text-center text-sm">
              <thead>
                <tr className="bg-[#0E78AA] text-white">
                  <th className="px-3 py-3">العقد / الوحدة</th>
                  <th className="px-3 py-3">البائع</th>
                  <th className="px-3 py-3">المشتري الجديد</th>
                  <th className="px-3 py-3">التقييم</th>
                  <th className="px-3 py-3">رسوم التنازل</th>
                  <th className="px-3 py-3">الحالة</th>
                  <th className="px-3 py-3">إجراء</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row, index) => (
                  <tr key={row.id} className={index % 2 ? 'bg-[#F6FBFD]' : 'bg-white'}>
                    <td className="px-3 py-3">
                      <Link href={`/real-estate/contracts/${row.unitContractId}`} className="text-[#0E79AA] underline">
                        {row.contract?.contractNumber}
                      </Link>
                      <div className="text-xs">{row.contract?.unit?.unitCode}</div>
                      {row.contract?.resaleLock ? <div className="mt-1 flex justify-center"><ResaleLockBadge locked /></div> : null}
                    </td>
                    <td className="px-3 py-3">{row.seller?.arabicName}</td>
                    <td className="px-3 py-3">{row.newBuyer?.arabicName}</td>
                    <td className="px-3 py-3 tabular-nums">{formatEgp(row.currentUnitMarketValue)}</td>
                    <td className="px-3 py-3 tabular-nums">
                      {formatEgp(row.assignmentFeeAmount)}
                      <div className="text-xs text-slate-500">{rateToPercent(row.assignmentFeeRate)}٪</div>
                    </td>
                    <td className="px-3 py-3">
                      <StatusBadge
                        compact
                        tone={row.clearanceStatus === 'FINANCIALLY_CLEARED' ? 'success' : row.clearanceStatus === 'REJECTED' ? 'danger' : 'warning'}
                        label={row.clearanceStatus === 'FINANCIALLY_CLEARED' ? 'مصفّى' : row.clearanceStatus === 'REJECTED' ? 'مرفوض' : 'بانتظار التصفية'}
                      />
                    </td>
                    <td className="px-3 py-3">
                      {row.clearanceStatus === 'PENDING_CLEARANCE' ? (
                        <Button size="sm" onClick={() => setClearRow(row)}>تصفية وتنفيذ</Button>
                      ) : (
                        '—'
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </ReCard>
      {requestOpen ? (
        <RequestResaleModal
          open
          contracts={contractsQ.data?.data ?? []}
          onClose={() => setRequestOpen(false)}
          onSaved={refresh}
        />
      ) : null}
      {clearRow ? (
        <ClearResaleModal open transfer={clearRow} onClose={() => setClearRow(null)} onSaved={refresh} />
      ) : null}
    </RealEstatePageShell>
  );
}
