'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { PageHeader } from '@/components/ui/PageHeader';
import { MetricTile } from '@/components/subcontracts/SubcontractPageShell';
import { useApiQuery } from '@/lib/hooks/useApi';
import { queryKeys, staleTimes } from '@/lib/query/query-keys';
import { formatEgp } from '@/lib/subcontracts/money';

type Summary = {
  totals: Record<string, number> & { totalActualCost: number; unallocated: number };
};

const LABELS: Record<string, string> = {
  MATERIAL: 'تكلفة المواد',
  LABOR: 'تكلفة العمالة',
  SUBCONTRACTOR: 'مقاولي الباطن',
  EQUIPMENT: 'تكلفة المعدات',
  DIRECT_EXPENSE: 'مصروفات',
  OVERHEAD: 'مصاريف عامة',
  OTHER: 'أخرى',
};

export default function ProjectActualCostPage() {
  const params = useParams<{ id: string }>();
  const projectId = params.id;
  const summaryQ = useApiQuery<Summary>(
    ['project-actual-cost', projectId],
    `/contracting/cost-control/projects/${projectId}/actual-cost/summary`,
    undefined,
    { staleTime: staleTimes.transactionalMs }
  );
  const boqQ = useApiQuery<{ items: Array<{ itemCode: string; descriptionAr: string; totals: Summary['totals'] }> }>(
    ['project-actual-cost-boq', projectId],
    `/contracting/cost-control/projects/${projectId}/actual-cost/boq`,
    undefined,
    { staleTime: staleTimes.transactionalMs }
  );
  const totals = summaryQ.data?.data?.totals;

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-4" dir="rtl">
      <PageHeader
        title="تكاليف المشروع"
        breadcrumbs={[
          { label: 'المشاريع', href: '/contracting/projects' },
          { label: 'التكلفة الفعلية' },
        ]}
      />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <MetricTile label="إجمالي التكلفة الفعلية" value={formatEgp(totals?.totalActualCost ?? 0)} />
        {(['MATERIAL', 'LABOR', 'SUBCONTRACTOR', 'EQUIPMENT', 'DIRECT_EXPENSE'] as const).map((key) => (
          <MetricTile key={key} label={LABELS[key]} value={formatEgp(totals?.[key] ?? 0)} />
        ))}
        <MetricTile label="غير موزعة على بنود" value={formatEgp(totals?.unallocated ?? 0)} />
      </div>
      <div className="overflow-x-auto rounded-xl border border-[#E6F0F7] bg-white">
        <table className="w-full min-w-[960px] text-center text-sm">
          <thead className="bg-[#0E78AA] text-white">
            <tr>
              <th className="px-2 py-2">البند</th>
              <th className="px-2 py-2">مواد</th>
              <th className="px-2 py-2">عمالة</th>
              <th className="px-2 py-2">مقاول باطن</th>
              <th className="px-2 py-2">معدات</th>
              <th className="px-2 py-2">مصروفات</th>
              <th className="px-2 py-2">إجمالي</th>
            </tr>
          </thead>
          <tbody>
            {(boqQ.data?.data?.items ?? []).map((row) => (
              <tr key={row.itemCode} className="border-t border-slate-100">
                <td className="px-2 py-2 text-start">
                  <p className="font-semibold">{row.itemCode}</p>
                  <p className="text-xs text-slate-500">{row.descriptionAr}</p>
                </td>
                <td className="tabular-nums">{formatEgp(row.totals.MATERIAL ?? 0)}</td>
                <td className="tabular-nums">{formatEgp(row.totals.LABOR ?? 0)}</td>
                <td className="tabular-nums">{formatEgp(row.totals.SUBCONTRACTOR ?? 0)}</td>
                <td className="tabular-nums">{formatEgp(row.totals.EQUIPMENT ?? 0)}</td>
                <td className="tabular-nums">{formatEgp(row.totals.DIRECT_EXPENSE ?? 0)}</td>
                <td className="tabular-nums font-semibold">{formatEgp(row.totals.totalActualCost ?? 0)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Link href={`/contracting/projects/${projectId}/client-billing`} className="text-sm text-[#0E78AA] underline">
        العودة لمستخلصات المالك
      </Link>
    </div>
  );
}
