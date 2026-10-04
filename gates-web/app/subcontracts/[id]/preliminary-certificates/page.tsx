'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { FilePlus2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/EmptyState';
import { PageHeader } from '@/components/ui/PageHeader';
import { PreliminaryStatusBadge } from '@/components/contracting/preliminary/PreliminaryStatusBadge';
import { SubcontractPageShell, SubcontractSkeleton } from '@/components/subcontracts/SubcontractPageShell';
import { apiClient } from '@/lib/api/client';
import type { SubPreliminaryCertificate } from '@/lib/contracting/preliminary-types';
import { useApiQuery } from '@/lib/hooks/useApi';
import { queryKeys, staleTimes } from '@/lib/query/query-keys';
import { formatDateAr, formatEgp } from '@/lib/subcontracts/money';
import type { SubcontractDetail } from '@/lib/subcontracts/types';

export default function SubPreliminaryListPage() {
  const params = useParams<{ id: string }>();
  const subcontractId = params.id;

  const detailQ = useApiQuery<SubcontractDetail>(
    queryKeys.subcontracts.detail(subcontractId),
    `/subcontracts/${subcontractId}`,
    undefined,
    { staleTime: staleTimes.transactionalMs, enabled: Boolean(subcontractId) }
  );
  const subcontract = detailQ.data?.data;

  const listQuery = useQuery({
    queryKey: ['sub-preliminary', subcontractId],
    enabled: Boolean(subcontractId),
    queryFn: async () => {
      const res = await apiClient.get<SubPreliminaryCertificate[]>(
        `/subcontracts/${subcontractId}/preliminary-certificates`
      );
      return res.data ?? [];
    },
  });

  return (
    <SubcontractPageShell>
      <PageHeader
        title="المستخلصات الابتدائية"
        breadcrumbs={[
          { label: 'مقاولو الباطن', href: '/subcontracts' },
          { label: subcontract?.subcontractNumber ?? 'العقد', href: `/subcontracts/${subcontractId}` },
          { label: 'المستخلصات الابتدائية' },
        ]}
        actions={
          subcontract?.status === 'ACTIVE' ? (
            <Link href={`/subcontracts/${subcontractId}/preliminary-certificates/new`}>
              <Button iconStart={<FilePlus2 className="h-4 w-4" />}>مستخلص ابتدائي جديد</Button>
            </Link>
          ) : undefined
        }
      />

      {detailQ.isLoading ? (
        <SubcontractSkeleton tiles={0} />
      ) : !subcontract ? (
        <EmptyState title="تعذر تحميل العقد" />
      ) : (
        <div className="overflow-x-auto rounded-xl border border-[#E6F0F7] bg-white">
          <table className="w-full min-w-[820px] text-center text-sm">
            <thead className="bg-[#F6FBFD] text-[#094C6B]">
              <tr>
                <th className="px-3 py-2">رقم المستخلص</th>
                <th className="px-3 py-2">الفترة</th>
                <th className="px-3 py-2">الحالة</th>
                <th className="px-3 py-2">قيمة الأعمال</th>
                <th className="px-3 py-2">صافي متوقع</th>
                <th className="px-3 py-2">فتح</th>
              </tr>
            </thead>
            <tbody>
              {(listQuery.data ?? []).map((row) => (
                <tr key={row.id} className="border-t border-slate-100">
                  <td className="px-3 py-2 font-semibold">{row.certificateNumber}</td>
                  <td className="px-3 py-2">
                    {formatDateAr(row.periodStartDate)} — {formatDateAr(row.periodEndDate)}
                  </td>
                  <td className="px-3 py-2">
                    <PreliminaryStatusBadge status={row.status} />
                  </td>
                  <td className="px-3 py-2 tabular-nums">{formatEgp(row.grossCurrentAmount)}</td>
                  <td className="px-3 py-2 tabular-nums">{formatEgp(row.netPayablePreview)}</td>
                  <td className="px-3 py-2">
                    <Link
                      href={`/subcontracts/${subcontractId}/preliminary-certificates/${row.id}`}
                      className="text-[#0E78AA] underline"
                    >
                      عرض
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!listQuery.data?.length ? (
            <p className="p-8 text-center text-sm text-slate-500">لا توجد مستخلصات ابتدائية بعد.</p>
          ) : null}
        </div>
      )}
    </SubcontractPageShell>
  );
}
