'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { FilePlus2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/EmptyState';
import { PageHeader } from '@/components/ui/PageHeader';
import { PreliminaryStatusBadge } from '@/components/contracting/preliminary/PreliminaryStatusBadge';
import { apiClient } from '@/lib/api/client';
import type { ClientContractDetail } from '@/lib/contracting/types';
import type { OwnerPreliminaryCertificate } from '@/lib/contracting/preliminary-types';
import { useApiQuery } from '@/lib/hooks/useApi';
import { queryKeys, staleTimes } from '@/lib/query/query-keys';
import { formatDateAr, formatEgp } from '@/lib/subcontracts/money';

export default function OwnerPreliminaryCertificatesPage() {
  const params = useParams<{ id: string }>();
  const projectId = params.id;

  const contractQ = useApiQuery<ClientContractDetail | null>(
    queryKeys.contracting.clientContract(projectId),
    `/contracting/client-billing/projects/${projectId}/contract`,
    undefined,
    { staleTime: staleTimes.transactionalMs, enabled: Boolean(projectId) }
  );
  const contract = contractQ.data?.data;

  const listQuery = useQuery({
    queryKey: ['owner-preliminary', contract?.id],
    enabled: Boolean(contract?.id),
    queryFn: async () => {
      const res = await apiClient.get<OwnerPreliminaryCertificate[]>(
        `/contracting/client-billing/contracts/${contract!.id}/preliminary-certificates`
      );
      return res.data ?? [];
    },
  });

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-4" dir="rtl">
      <PageHeader
        title="المستخلصات الابتدائية"
        breadcrumbs={[
          { label: 'المشاريع', href: '/contracting/projects' },
          { label: 'مستخلصات المالك', href: `/contracting/projects/${projectId}/client-billing` },
          { label: 'المستخلصات الابتدائية' },
        ]}
        actions={
          contract ? (
            <div className="flex flex-wrap gap-2">
              <Link href={`/contracting/projects/${projectId}/preliminary-certificates/new`}>
                <Button iconStart={<FilePlus2 className="h-4 w-4" />}>مستخلص ابتدائي جديد</Button>
              </Link>
              <Link href={`/contracting/projects/${projectId}/client-billing`}>
                <Button variant="secondary">مستخلصات المالك المالية</Button>
              </Link>
            </div>
          ) : undefined
        }
      />

      {!contract ? (
        <EmptyState title="سجّل عقد المالك أولاً" description="من شاشة مستخلصات المالك." />
      ) : listQuery.isLoading ? (
        <p className="text-sm text-slate-500">جاري التحميل…</p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
          <table className="w-full min-w-[880px] text-center text-sm">
            <thead className="bg-slate-50 text-slate-600">
              <tr>
                <th className="px-3 py-2">رقم المستخلص</th>
                <th className="px-3 py-2">الفترة</th>
                <th className="px-3 py-2">الحالة</th>
                <th className="px-3 py-2">قيمة الأعمال الحالية</th>
                <th className="px-3 py-2">التراكمي</th>
                <th className="px-3 py-2">تاريخ التقديم</th>
                <th className="px-3 py-2">تاريخ الاعتماد</th>
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
                  <td className="px-3 py-2 tabular-nums">{formatEgp(row.grossCurrentWorks)}</td>
                  <td className="px-3 py-2 tabular-nums">{formatEgp(row.cumulativeGrossWorks)}</td>
                  <td className="px-3 py-2">{row.submittedAt ? formatDateAr(row.submittedAt) : '—'}</td>
                  <td className="px-3 py-2">{row.approvedAt ? formatDateAr(row.approvedAt) : '—'}</td>
                  <td className="px-3 py-2">
                    <Link
                      href={`/contracting/projects/${projectId}/preliminary-certificates/${row.id}`}
                      className="text-[#0E78AA] underline"
                    >
                      {row.status === 'CONVERTED' && row.clientInvoiceId ? 'عرض / مالي' : 'عرض'}
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!listQuery.data?.length ? (
            <p className="p-6 text-center text-sm text-slate-500">لا توجد مستخلصات ابتدائية بعد.</p>
          ) : null}
        </div>
      )}
    </div>
  );
}
