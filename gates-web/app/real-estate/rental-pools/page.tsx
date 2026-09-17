'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/EmptyState';
import { RealEstatePageShell, ReCard, RealEstateWorkspaceHeader } from '@/components/real-estate/RealEstatePageShell';
import { TableSkeleton } from '@/components/ui/TableSkeleton';
import { useApiQuery, useInvalidateQuery } from '@/lib/hooks/useApi';
import { queryKeys, staleTimes } from '@/lib/query/query-keys';
import { formatDateAr, formatEgp, rateToPercent } from '@/lib/real-estate/format';
import type { RentalPoolAgreement } from '@/lib/real-estate/types';
import { lazyNamedModal } from '@/components/ui/lazyModal';

const DistributeRentModal = lazyNamedModal(
  () => import('@/components/real-estate/DistributeRentModal'),
  'DistributeRentModal',
  'جاري تحميل توزيع الإيجار…'
);

export default function RentalPoolsPage() {
  const invalidate = useInvalidateQuery();
  const [active, setActive] = useState<RentalPoolAgreement | null>(null);
  const { data, isLoading, isError } = useApiQuery<RentalPoolAgreement[]>(
    queryKeys.realEstate.rentalPools(),
    '/real-estate/rental-pools',
    undefined,
    { staleTime: staleTimes.transactionalMs, refetchOnWindowFocus: true }
  );
  const rows = data?.data ?? [];

  return (
    <RealEstatePageShell>
      <RealEstateWorkspaceHeader
        title="توزيع إيجار المجمع التجاري"
        breadcrumbs={[
          { label: 'الاستثمار العقاري', href: '/real-estate-investment' },
          { label: 'مجمع الإيجار' },
        ]}
        favoriteHref="/real-estate/rental-pools"
      />
      <ReCard>
        {isLoading ? (
          <TableSkeleton columns={5} rows={6} />
        ) : isError ? (
          <EmptyState title="تعذر تحميل اتفاقيات الإيجار" />
        ) : rows.length === 0 ? (
          <EmptyState title="لا توجد اتفاقيات مجمع إيجاري" description="تظهر هنا الاتفاقيات النشطة لتوزيع الصافي على المالك." />
        ) : (
          <div className="overflow-x-auto rounded-xl border border-[#E6F0F7]">
            <table className="w-full min-w-[860px] text-center text-sm">
              <thead>
                <tr className="bg-[#0E78AA] text-white">
                  <th className="px-3 py-3">الوحدة</th>
                  <th className="px-3 py-3">المالك</th>
                  <th className="px-3 py-3">أتعاب الإدارة</th>
                  <th className="px-3 py-3">آخر توزيع</th>
                  <th className="px-3 py-3">إجراء</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row, index) => {
                  const last = row.distributions?.[0];
                  return (
                    <tr key={row.id} className={index % 2 ? 'bg-[#F6FBFD]' : 'bg-white'}>
                      <td className="px-3 py-3 font-semibold">{row.propertyUnit?.unitCode ?? '—'}</td>
                      <td className="px-3 py-3">{row.owner?.arabicName ?? '—'}</td>
                      <td className="px-3 py-3">{rateToPercent(row.managementFeeRate)}٪</td>
                      <td className="px-3 py-3">
                        {last ? `${formatDateAr(last.periodEnd)} — ${formatEgp(last.netDistributedAmount)}` : '—'}
                      </td>
                      <td className="px-3 py-3">
                        <Button size="sm" disabled={!row.isActive} onClick={() => setActive(row)}>
                          توزيع الفترة
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </ReCard>
      {active ? (
        <DistributeRentModal
          open
          agreement={active}
          onClose={() => setActive(null)}
          onSaved={() => invalidate(queryKeys.realEstate.rentalPools())}
        />
      ) : null}
    </RealEstatePageShell>
  );
}
