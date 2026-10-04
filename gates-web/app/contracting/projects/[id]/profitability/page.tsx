'use client';

import { useParams } from 'next/navigation';
import { useMemo, useState } from 'react';
import { PageHeader } from '@/components/ui/PageHeader';
import { MetricTile } from '@/components/subcontracts/SubcontractPageShell';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { useApiQuery } from '@/lib/hooks/useApi';
import { queryKeys, staleTimes } from '@/lib/query/query-keys';
import { formatEgp } from '@/lib/subcontracts/money';

type ProfitabilitySummary = {
  revenue: {
    originalContractValue: number;
    approvedVariationImpact: number;
    revisedContractValue: number;
    operationalCertifiedValue: number;
    financiallyCertifiedRevenue: number;
    collectedRevenue: number;
    outstandingCertifiedReceivable: number;
  };
  cost: {
    plannedCost: number;
    actualCost: number;
    unallocatedActualCost: number;
    remainingCommitment: number;
    uncommittedCostToComplete: number;
    estimateAtCompletion: number;
    forecastProfit: number;
    forecastMarginPercent: number | null;
    currentCertifiedGrossMargin: number;
  };
  progress: { progressPercent: number };
  signals: Array<{ code: string; message: string; severity: string }>;
};

type BoqRow = {
  projectBOQItemId: string;
  itemCode: string;
  descriptionAr: string;
  effectiveSellingValue: number;
  plannedTotalCost: number | null;
  actualCost: number;
  remainingCommitment: number;
  forecastRemainingCost: number;
  estimateAtCompletion: number;
  forecastProfit: number | null;
  forecastMarginPercent: number | null;
  progressPercent: number | null;
  signals: string[];
};

export default function ProjectProfitabilityPage() {
  const params = useParams<{ id: string }>();
  const projectId = params.id;
  const [sort, setSort] = useState<'margin' | 'loss' | 'overrun'>('margin');

  const summaryQ = useApiQuery<ProfitabilitySummary>(
    queryKeys.contracting.profitabilitySummary(projectId),
    `/contracting/cost-control/projects/${projectId}/profitability/summary`,
    undefined,
    { staleTime: staleTimes.transactionalMs }
  );
  const boqQ = useApiQuery<{ items: BoqRow[] }>(
    queryKeys.contracting.profitabilityBoq(projectId),
    `/contracting/cost-control/projects/${projectId}/profitability/boq`,
    undefined,
    { staleTime: staleTimes.transactionalMs }
  );
  const snapshotsQ = useApiQuery<
    Array<{ id: string; snapshotDate: string; actualCost: number; estimateAtCompletion: number; forecastProfit: number; forecastMarginPercent: number }>
  >(
    queryKeys.contracting.profitabilitySnapshots(projectId),
    `/contracting/cost-control/projects/${projectId}/profitability/snapshots`,
    undefined,
    { staleTime: staleTimes.transactionalMs }
  );

  const s = summaryQ.data?.data;
  const sortedBoq = useMemo(() => {
    const items = [...(boqQ.data?.data?.items ?? [])];
    if (sort === 'margin') items.sort((a, b) => (a.forecastMarginPercent ?? 999) - (b.forecastMarginPercent ?? 999));
    if (sort === 'loss') items.sort((a, b) => (a.forecastProfit ?? 0) - (b.forecastProfit ?? 0));
    if (sort === 'overrun') {
      items.sort(
        (a, b) =>
          (b.estimateAtCompletion - (b.plannedTotalCost ?? 0)) -
          (a.estimateAtCompletion - (a.plannedTotalCost ?? 0))
      );
    }
    return items;
  }, [boqQ.data?.data?.items, sort]);

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-4" dir="rtl">
      <PageHeader
        title="مراقبة وربحية المشروع"
        breadcrumbs={[
          { label: 'المشاريع', href: '/contracting/projects' },
          { label: 'الربحية والرقابة' },
        ]}
      />

      {s?.signals?.length ? (
        <div className="flex flex-wrap gap-2">
          {s.signals.map((sig) => (
            <StatusBadge
              key={sig.code}
              label={`${sig.code}: ${sig.message}`}
              tone={sig.severity === 'critical' ? 'danger' : 'warning'}
            />
          ))}
        </div>
      ) : null}

      <section className="space-y-2">
        <h2 className="text-sm font-bold text-[#094C6B]">العقد والإيراد</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <MetricTile label="قيمة العقد الأصلية" value={formatEgp(s?.revenue.originalContractValue ?? 0)} />
          <MetricTile label="أوامر التغيير" value={formatEgp(s?.revenue.approvedVariationImpact ?? 0)} />
          <MetricTile label="القيمة المعدلة للعقد" value={formatEgp(s?.revenue.revisedContractValue ?? 0)} />
          <MetricTile label="قيمة الأعمال المعتمدة (تشغيلي)" value={formatEgp(s?.revenue.operationalCertifiedValue ?? 0)} />
          <MetricTile label="المستخلصات المالية" value={formatEgp(s?.revenue.financiallyCertifiedRevenue ?? 0)} />
          <MetricTile label="المحصل (نقد)" value={formatEgp(s?.revenue.collectedRevenue ?? 0)} />
          <MetricTile label="متبقي مستحقات معتمدة" value={formatEgp(s?.revenue.outstandingCertifiedReceivable ?? 0)} />
          <MetricTile label="هامش معتمد − فعلي (حالي)" value={formatEgp(s?.cost.currentCertifiedGrossMargin ?? 0)} />
        </div>
      </section>

      <section className="space-y-2">
        <h2 className="text-sm font-bold text-[#094C6B]">التكلفة والتوقعات</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <MetricTile label="التكلفة المخططة" value={formatEgp(s?.cost.plannedCost ?? 0)} />
          <MetricTile label="التكلفة الفعلية (P2-1)" value={formatEgp(s?.cost.actualCost ?? 0)} />
          <MetricTile label="غير موزعة على بنود" value={formatEgp(s?.cost.unallocatedActualCost ?? 0)} />
          <MetricTile label="الالتزامات المتبقية" value={formatEgp(s?.cost.remainingCommitment ?? 0)} />
          <MetricTile label="متبقي غير ملتزم (توقع)" value={formatEgp(s?.cost.uncommittedCostToComplete ?? 0)} />
          <MetricTile label="التكلفة المتوقعة عند الإتمام" value={formatEgp(s?.cost.estimateAtCompletion ?? 0)} />
          <MetricTile label="الربح المتوقع" value={formatEgp(s?.cost.forecastProfit ?? 0)} />
          <MetricTile
            label="هامش الربح المتوقع"
            value={s?.cost.forecastMarginPercent != null ? `${s.cost.forecastMarginPercent.toFixed(2)}%` : '—'}
          />
          <MetricTile label="نسبة الإنجاز" value={`${(s?.progress.progressPercent ?? 0).toFixed(1)}%`} />
        </div>
      </section>

      <section className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-bold text-[#094C6B]">ربحية بنود BOQ</h2>
          <select
            className="rounded-lg border border-slate-200 px-3 py-1 text-sm"
            value={sort}
            onChange={(e) => setSort(e.target.value as typeof sort)}
          >
            <option value="margin">أقل هامش</option>
            <option value="loss">أكبر خسارة</option>
            <option value="overrun">أكبر تجاوز تكلفة</option>
          </select>
        </div>
        <div className="overflow-x-auto rounded-xl border border-[#E6F0F7] bg-white">
          <table className="w-full min-w-[1100px] text-center text-sm">
            <thead className="bg-[#0E78AA] text-white">
              <tr>
                <th className="px-2 py-2">البند</th>
                <th className="px-2 py-2">القيمة البيعية</th>
                <th className="px-2 py-2">التكلفة المخططة</th>
                <th className="px-2 py-2">التكلفة الفعلية</th>
                <th className="px-2 py-2">الالتزامات</th>
                <th className="px-2 py-2">المتبقي المتوقع</th>
                <th className="px-2 py-2">عند الإتمام</th>
                <th className="px-2 py-2">الربح المتوقع</th>
                <th className="px-2 py-2">هامش الربح</th>
                <th className="px-2 py-2">نسبة الإنجاز</th>
              </tr>
            </thead>
            <tbody>
              {sortedBoq.map((row) => (
                <tr key={row.projectBOQItemId} className="border-t border-slate-100">
                  <td className="px-2 py-2 text-start">
                    <p className="font-semibold">{row.itemCode}</p>
                    <p className="text-xs text-slate-500">{row.descriptionAr}</p>
                  </td>
                  <td className="tabular-nums">{formatEgp(row.effectiveSellingValue)}</td>
                  <td className="tabular-nums">{row.plannedTotalCost != null ? formatEgp(row.plannedTotalCost) : '—'}</td>
                  <td className="tabular-nums">{formatEgp(row.actualCost)}</td>
                  <td className="tabular-nums">{formatEgp(row.remainingCommitment)}</td>
                  <td className="tabular-nums">{formatEgp(row.forecastRemainingCost)}</td>
                  <td className="tabular-nums">{formatEgp(row.estimateAtCompletion)}</td>
                  <td className="tabular-nums">{row.forecastProfit != null ? formatEgp(row.forecastProfit) : '—'}</td>
                  <td className="tabular-nums">
                    {row.forecastMarginPercent != null ? `${row.forecastMarginPercent.toFixed(1)}%` : '—'}
                  </td>
                  <td className="tabular-nums">
                    {row.progressPercent != null ? `${row.progressPercent.toFixed(0)}%` : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="space-y-2">
        <h2 className="text-sm font-bold text-[#094C6B]">سجل اللقطات</h2>
        <div className="overflow-x-auto rounded-xl border border-[#E6F0F7] bg-white">
          <table className="w-full text-center text-sm">
            <thead className="bg-slate-100">
              <tr>
                <th className="px-2 py-2">التاريخ</th>
                <th className="px-2 py-2">التكلفة الفعلية</th>
                <th className="px-2 py-2">EAC</th>
                <th className="px-2 py-2">الربح المتوقع</th>
                <th className="px-2 py-2">الهامش</th>
              </tr>
            </thead>
            <tbody>
              {(snapshotsQ.data?.data ?? []).map((row) => (
                <tr key={row.id} className="border-t">
                  <td className="px-2 py-2">{new Date(row.snapshotDate).toLocaleDateString('ar-EG')}</td>
                  <td className="tabular-nums">{formatEgp(row.actualCost)}</td>
                  <td className="tabular-nums">{formatEgp(row.estimateAtCompletion)}</td>
                  <td className="tabular-nums">{formatEgp(row.forecastProfit)}</td>
                  <td className="tabular-nums">{row.forecastMarginPercent.toFixed(2)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
