'use client';

import { useParams } from 'next/navigation';
import { PageHeader } from '@/components/ui/PageHeader';
import { MetricTile } from '@/components/subcontracts/SubcontractPageShell';
import { useApiQuery } from '@/lib/hooks/useApi';
import { queryKeys, staleTimes } from '@/lib/query/query-keys';
import { formatEgp } from '@/lib/subcontracts/money';

type PerformanceSummary = {
  progress: { plannedPercent: number; actualPercent: number; scheduleVariancePoints: number };
  evm: {
    pv: number;
    ev: number;
    ac: number;
    cpi: number | null;
    spi: number | null;
    bac: number;
  };
  schedule: {
    currentPlannedFinish: string | null;
    forecastFinish: string | null;
    originalBaselineFinish: string | null;
  };
  financial: {
    actualCost: number;
    eac: number;
    forecastProfit: number;
    forecastMarginPercent: number | null;
    certifiedRevenue: number;
    collectedCash: number;
  };
  health: Array<{ code: string; message: string; severity: string }>;
};

export default function ProjectPerformancePage() {
  const params = useParams<{ id: string }>();
  const projectId = params.id;

  const summaryQ = useApiQuery<PerformanceSummary>(
    queryKeys.contracting.executionPerformance(projectId),
    `/contracting/execution/projects/${projectId}/performance/summary`,
    undefined,
    { staleTime: staleTimes.transactionalMs }
  );

  const activitiesQ = useApiQuery<
    Array<{
      code: string;
      nameAr: string;
      plannedPercent: number;
      actualPercent: number;
      pv: number;
      ev: number;
      acShare: number;
      cpi: number | null;
      spi: number | null;
      status: string;
    }>
  >(
    queryKeys.contracting.executionActivities(projectId),
    `/contracting/execution/projects/${projectId}/performance/activities`,
    undefined,
    { staleTime: staleTimes.transactionalMs }
  );

  const s = summaryQ.data?.data;

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-4" dir="rtl">
      <PageHeader
        title="أداء المشروع"
        breadcrumbs={[
          { label: 'المشاريع', href: '/contracting/projects' },
          { label: 'أداء المشروع' },
        ]}
      />

      {s && (
        <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <MetricTile label="الإنجاز المخطط" value={`${s.progress.plannedPercent.toFixed(1)}%`} />
            <MetricTile label="الإنجاز الفعلي" value={`${s.progress.actualPercent.toFixed(1)}%`} />
            <MetricTile
              label="انحراف الجدول (نقطة مئوية)"
              value={`${s.progress.scheduleVariancePoints.toFixed(1)}`}
            />
            <MetricTile label="SPI" value={s.evm.spi?.toFixed(3) ?? '—'} />
            <MetricTile label="CPI" value={s.evm.cpi?.toFixed(3) ?? '—'} />
            <MetricTile label="التكلفة الفعلية" value={formatEgp(s.financial.actualCost)} />
            <MetricTile label="EAC" value={formatEgp(s.financial.eac)} />
            <MetricTile label="الربح المتوقع" value={formatEgp(s.financial.forecastProfit)} />
            <MetricTile
              label="هامش الربح المتوقع"
              value={
                s.financial.forecastMarginPercent != null
                  ? `${s.financial.forecastMarginPercent.toFixed(1)}%`
                  : '—'
              }
            />
            <MetricTile label="النهاية المخططة" value={s.schedule.currentPlannedFinish ?? '—'} />
            <MetricTile label="النهاية المتوقعة" value={s.schedule.forecastFinish ?? '—'} />
          </div>

          <div className="rounded-2xl border border-[#D6EAF3] bg-white p-4 text-xs text-[#094C6B]">
            <div className="font-bold">EVM (تكلفة ميزانية — ليس الإيراد)</div>
            <div>
              PV {formatEgp(s.evm.pv)} · EV {formatEgp(s.evm.ev)} · AC {formatEgp(s.evm.ac)} · BAC{' '}
              {formatEgp(s.evm.bac)}
            </div>
            <div className="mt-2 text-muted-foreground">
              إيراد معتمد ماليًا: {formatEgp(s.financial.certifiedRevenue)} · تحصيل:{' '}
              {formatEgp(s.financial.collectedCash)}
            </div>
          </div>

          {s.health.length > 0 && (
            <ul className="space-y-2">
              {s.health.map((h, i) => (
                <li
                  key={`${h.code}-${i}`}
                  className="rounded-xl border border-[#D6EAF3] bg-[#F6FBFD] px-4 py-2 text-sm"
                >
                  <span className="font-mono text-xs">{h.code}</span> — {h.message}
                </li>
              ))}
            </ul>
          )}

          <div className="overflow-x-auto rounded-2xl border border-[#D6EAF3] bg-white">
            <table className="min-w-full text-sm">
              <thead className="bg-[#F6FBFD]">
                <tr>
                  <th className="px-3 py-2 text-right">النشاط</th>
                  <th className="px-3 py-2 text-right">مخطط %</th>
                  <th className="px-3 py-2 text-right">فعلي %</th>
                  <th className="px-3 py-2 text-right">PV</th>
                  <th className="px-3 py-2 text-right">EV</th>
                  <th className="px-3 py-2 text-right">AC</th>
                  <th className="px-3 py-2 text-right">CPI</th>
                  <th className="px-3 py-2 text-right">SPI</th>
                  <th className="px-3 py-2 text-right">الحالة</th>
                </tr>
              </thead>
              <tbody>
                {(activitiesQ.data?.data ?? []).map((row) => (
                  <tr key={row.code} className="border-t">
                    <td className="px-3 py-2">
                      {row.code} — {row.nameAr}
                    </td>
                    <td className="px-3 py-2">{row.plannedPercent.toFixed(1)}</td>
                    <td className="px-3 py-2">{row.actualPercent.toFixed(1)}</td>
                    <td className="px-3 py-2">{formatEgp(row.pv)}</td>
                    <td className="px-3 py-2">{formatEgp(row.ev)}</td>
                    <td className="px-3 py-2">{formatEgp(row.acShare)}</td>
                    <td className="px-3 py-2">{row.cpi?.toFixed(3) ?? '—'}</td>
                    <td className="px-3 py-2">{row.spi?.toFixed(3) ?? '—'}</td>
                    <td className="px-3 py-2">{row.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
