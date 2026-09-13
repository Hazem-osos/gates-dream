'use client';

import { useState } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/EmptyState';
import { PageHeader } from '@/components/ui/PageHeader';
import { TableSkeleton } from '@/components/ui/TableSkeleton';
import { DynamicModalSkeleton } from '@/components/ui/DynamicChunkSkeleton';
import { SubcontractCard, SubcontractPageShell } from '@/components/subcontracts/SubcontractPageShell';
import { InvoiceStatusBadge, SubcontractStatusBadge } from '@/components/subcontracts/SubcontractStatusBadge';
import { useApiQuery } from '@/lib/hooks/useApi';
import { queryKeys, staleTimes } from '@/lib/query/query-keys';
import { formatDateAr, formatEgp, toMoney } from '@/lib/subcontracts/money';
import type { SubcontractListItem } from '@/lib/subcontracts/types';

const CreateSubcontractModal = dynamic(
  () =>
    import('@/components/subcontracts/CreateSubcontractModal').then((m) => ({
      default: m.CreateSubcontractModal,
    })),
  { ssr: false, loading: () => <DynamicModalSkeleton label="جاري تحميل عقد المقاول…" /> }
);

export default function SubcontractsListPage() {
  const router = useRouter();
  const [createOpen, setCreateOpen] = useState(false);
  const { data, isLoading, isError } = useApiQuery<SubcontractListItem[]>(
    queryKeys.subcontracts.list(),
    '/subcontracts',
    undefined,
    { staleTime: staleTimes.transactionalMs }
  );
  const rows = data?.data ?? [];

  return (
    <SubcontractPageShell>
      <PageHeader
        title="سجل عقود مقاولي الباطن"
        description="عقود الباطن، جداول الكميات، والمستخلصات الجارية."
        breadcrumbs={[
          { label: 'لوحة المقاولين', href: '/subcontracts' },
          { label: 'العقود' },
        ]}
        actions={
          <Button iconStart={<Plus className="h-4 w-4" />} onClick={() => setCreateOpen(true)}>
            عقد باطن جديد
          </Button>
        }
      />

      <SubcontractCard>
        {isLoading ? (
          <TableSkeleton columns={6} rows={8} />
        ) : isError ? (
          <EmptyState title="تعذر تحميل العقود" description="تحقق من اتصال الخادم وصلاحية الفرع ثم أعد المحاولة." />
        ) : rows.length === 0 ? (
          <EmptyState
            title="لا توجد عقود باطن"
            description="أنشئ عقد مقاول باطن وربطه بمشروع مقاولات لبدء بنود الأعمال والمستخلصات."
            action={
              <Button size="sm" onClick={() => setCreateOpen(true)}>
                إنشاء أول عقد
              </Button>
            }
          />
        ) : (
          <div className="overflow-x-auto rounded-xl border border-[#E6F0F7]">
            <table className="w-full min-w-[860px] text-center text-sm">
              <thead>
                <tr className="bg-[#0E78AA] text-white">
                  <th className="px-3 py-3">رقم العقد</th>
                  <th className="px-3 py-3">المقاول</th>
                  <th className="px-3 py-3">المشروع</th>
                  <th className="px-3 py-3">قيمة العقد</th>
                  <th className="px-3 py-3">المستخلصات</th>
                  <th className="px-3 py-3">الحالة</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row, index) => {
                  const last = row.invoices[row.invoices.length - 1];
                  return (
                    <tr key={row.id} className={index % 2 ? 'bg-[#F6FBFD]' : 'bg-white'}>
                      <td className="px-3 py-3">
                        <Link href={`/subcontracts/${row.id}`} className="font-semibold text-[#0E79AA] underline">
                          {row.subcontractNumber}
                        </Link>
                        <div className="text-xs text-slate-500">{formatDateAr(row.contractDate)}</div>
                      </td>
                      <td className="px-3 py-3">
                        <div>{row.subcontractor?.nameAr}</div>
                        <div className="text-xs text-slate-500">{row.subcontractor?.taxRegistrationNumber ?? '—'}</div>
                      </td>
                      <td className="px-3 py-3">
                        {row.project?.projectCode} — {row.project?.projectName}
                      </td>
                      <td className="px-3 py-3 tabular-nums">{formatEgp(row.totalContractValue)}</td>
                      <td className="px-3 py-3">
                        <div>{row.invoices.length}</div>
                        {last ? (
                          <div className="mt-1 flex justify-center">
                            <InvoiceStatusBadge status={last.status} />
                          </div>
                        ) : (
                          <span className="text-xs text-slate-400">لا يوجد</span>
                        )}
                      </td>
                      <td className="px-3 py-3">
                        <SubcontractStatusBadge status={row.status} />
                        <div className="mt-1 text-xs text-slate-500">
                          مرحّل: {formatEgp(row.invoices.reduce((sum, inv) => sum + toMoney(inv.grossCurrentAmount), 0))}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </SubcontractCard>

      {createOpen ? (
        <CreateSubcontractModal
          open
          onClose={() => setCreateOpen(false)}
          onCreated={(id) => router.push(`/subcontracts/${id}`)}
        />
      ) : null}
    </SubcontractPageShell>
  );
}
