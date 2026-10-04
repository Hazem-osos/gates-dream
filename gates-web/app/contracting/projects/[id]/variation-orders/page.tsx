'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { FilePlus2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/ui/PageHeader';
import { PreliminaryStatusBadge } from '@/components/contracting/preliminary/PreliminaryStatusBadge';
import { apiClient } from '@/lib/api/client';
import type { ContractVariationOrder } from '@/lib/contracting/variation-types';
import type { ClientContractDetail } from '@/lib/contracting/types';
import { useApiQuery } from '@/lib/hooks/useApi';
import { queryKeys, staleTimes } from '@/lib/query/query-keys';
import { formatDateAr, formatEgp } from '@/lib/subcontracts/money';

export default function VariationOrdersListPage() {
  const params = useParams<{ id: string }>();
  const projectId = params.id;

  const contractQ = useApiQuery<ClientContractDetail | null>(
    queryKeys.contracting.clientContract(projectId),
    `/contracting/client-billing/projects/${projectId}/contract`,
    undefined,
    { staleTime: staleTimes.transactionalMs }
  );
  const contract = contractQ.data?.data;

  const listQ = useQuery({
    queryKey: ['contract-variation-list', contract?.id],
    enabled: Boolean(contract?.id),
    queryFn: async () => {
      const res = await apiClient.get<ContractVariationOrder[]>(
        `/contracting/client-billing/contracts/${contract!.id}/variation-orders`
      );
      return res.data ?? [];
    },
  });

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-4" dir="rtl">
      <PageHeader
        title="أوامر التغيير"
        breadcrumbs={[
          { label: 'المشاريع', href: '/contracting/projects' },
          { label: 'مستخلصات المالك', href: `/contracting/projects/${projectId}/client-billing` },
          { label: 'أوامر التغيير' },
        ]}
        actions={
          contract ? (
            <Link href={`/contracting/projects/${projectId}/variation-orders/new`}>
              <Button iconStart={<FilePlus2 className="h-4 w-4" />}>أمر تغيير جديد</Button>
            </Link>
          ) : undefined
        }
      />
      {!contract ? (
        <p className="text-sm text-slate-600">سجّل عقد المالك أولاً.</p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
          <table className="w-full min-w-[900px] text-center text-sm">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-3 py-2">رقم الأمر</th>
                <th className="px-3 py-2">التاريخ</th>
                <th className="px-3 py-2">الحالة</th>
                <th className="px-3 py-2">سبب التغيير</th>
                <th className="px-3 py-2">زيادة</th>
                <th className="px-3 py-2">تخفيض</th>
                <th className="px-3 py-2">صافي التأثير</th>
                <th className="px-3 py-2">قيمة العقد المعدلة</th>
                <th className="px-3 py-2">فتح</th>
              </tr>
            </thead>
            <tbody>
              {(listQ.data ?? []).map((row) => (
                <tr key={row.id} className="border-t border-slate-100">
                  <td className="px-3 py-2 font-semibold">{row.orderNumber}</td>
                  <td className="px-3 py-2">{formatDateAr(row.orderDate)}</td>
                  <td className="px-3 py-2">
                    <PreliminaryStatusBadge status={row.status} />
                  </td>
                  <td className="max-w-[200px] truncate px-3 py-2 text-start">{row.reason}</td>
                  <td className="px-3 py-2 tabular-nums">{formatEgp(row.increaseValue)}</td>
                  <td className="px-3 py-2 tabular-nums">{formatEgp(row.decreaseValue)}</td>
                  <td className="px-3 py-2 tabular-nums">{formatEgp(row.netImpact)}</td>
                  <td className="px-3 py-2 tabular-nums">{formatEgp(row.revisedContractValueSnapshot)}</td>
                  <td className="px-3 py-2">
                    <Link
                      href={`/contracting/projects/${projectId}/variation-orders/${row.id}`}
                      className="text-[#0E78AA] underline"
                    >
                      عرض
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
