'use client';

import Link from 'next/link';
import { Activity, ArrowUpLeft, RefreshCw } from 'lucide-react';
import { useBackendReachability } from '@/lib/hooks/useBackendReachability';
import { formatMoney } from '@/lib/hooks/useExecutiveDashboard';
import { localizeApiErrorMessage } from '@/lib/api/api-error-notify';
import {
  useDiagnosticReport,
  type DiagnosticMetric,
  type DiagnosticProbeResult,
  type DiagnosticStatus,
} from '@/lib/hooks/useDiagnosticReport';
import { CommandCenter, DASH_NUM, DASH_PANEL, HUD_BTN_GHOST } from '@/components/dashboard-primitives';

function statusTone(status: DiagnosticStatus) {
  if (status === 'excellent') return 'border-emerald-200 bg-emerald-50 text-emerald-800';
  if (status === 'stable') return 'border-amber-200 bg-amber-50 text-amber-800';
  return 'border-rose-200 bg-rose-50 text-rose-800';
}

function gaugeColor(status: DiagnosticStatus) {
  if (status === 'excellent') return '#059669';
  if (status === 'stable') return '#D97706';
  return '#E11D48';
}

function formatMetric(metric: DiagnosticMetric) {
  if (metric.unit === 'money') return formatMoney(metric.value);
  if (metric.unit === 'percent') return `${metric.value}%`;
  if (metric.unit === 'days') return `${metric.value} ي`;
  if (metric.unit === 'months') return `${metric.value}`;
  return String(metric.value);
}

function HealthGauge({ score, status }: { score: number; status: DiagnosticStatus }) {
  const clamped = Math.max(0, Math.min(100, score));
  const color = gaugeColor(status);
  return (
    <div
      className="relative mx-auto flex h-40 w-40 items-center justify-center rounded-full"
      style={{ background: `conic-gradient(${color} ${clamped * 3.6}deg, #E2E8F0 0deg)` }}
      aria-label={`الصحة المؤسسية ${clamped} من 100`}
    >
      <div className="flex h-[7.25rem] w-[7.25rem] flex-col items-center justify-center rounded-full bg-white shadow-inner">
        <span className={`text-3xl font-bold tracking-tight ${DASH_NUM}`} style={{ color }}>
          {clamped}
        </span>
        <span className="text-[11px] text-slate-500">/ 100</span>
      </div>
    </div>
  );
}

function ProbeSkeleton() {
  return (
    <div className={`${DASH_PANEL} animate-pulse p-4`}>
      <div className="mb-3 h-4 w-28 rounded bg-slate-200" />
      <div className="mb-2 h-3 w-full rounded bg-slate-100" />
      <div className="h-3 w-2/3 rounded bg-slate-100" />
    </div>
  );
}

function ProbeCard({ probe }: { probe: DiagnosticProbeResult }) {
  return (
    <article className={`${DASH_PANEL} p-4`}>
      <div className="mb-3 flex items-start justify-between gap-2">
        <div>
          <h3 className="text-sm font-bold text-slate-900">{probe.labelAr}</h3>
          <p className="text-[11px] text-slate-500">{probe.findings[0]}</p>
        </div>
        <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${statusTone(probe.status)}`}>
          {probe.score}/100
        </span>
      </div>
      <dl className="grid grid-cols-3 gap-2">
        {probe.metrics.map((metric) => (
          <div key={metric.id} className="rounded-lg bg-slate-50 px-2 py-2">
            <dt className="text-[10px] text-slate-500">{metric.label}</dt>
            <dd className={`mt-0.5 text-[13px] font-semibold text-slate-900 ${DASH_NUM}`}>{formatMetric(metric)}</dd>
          </div>
        ))}
      </dl>
      {probe.actions[0] ? (
        <Link
          href={probe.actions[0].href}
          className="mt-3 inline-flex items-center gap-1 text-[11px] font-semibold text-[#0E79AA]"
        >
          {probe.actions[0].label}
          <ArrowUpLeft className="h-3 w-3" />
        </Link>
      ) : null}
    </article>
  );
}

export default function CorporateDiagnosticPage() {
  useBackendReachability();
  const { report, isLoading, isFetching, isError, error, refetch } = useDiagnosticReport();
  const probeByKey = new Map((report?.probes ?? []).map((probe) => [probe.key, probe]));

  return (
    <CommandCenter
      title="المشخّص المؤسسي الشامل"
      module="DIAGNOSTIC"
      asOf={report?.asOf}
      refreshing={isFetching}
      onRefresh={() => void refetch()}
      shortcuts={[
        { key: 'F8', label: 'الإدارة العليا', href: '/executive' },
        { key: 'F2', label: 'التشغيل', href: '/' },
        { key: 'F7', label: 'النمو', href: '/growth' },
      ]}
      filters={
        <button
          type="button"
          onClick={() => void refetch()}
          className={HUD_BTN_GHOST}
        >
          <RefreshCw className={`h-3.5 w-3.5 ${isFetching ? 'animate-spin' : ''}`} />
          تحديث الفحص التشخيصي
        </button>
      }
    >
      {isError ? (
        <p className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-[12px] text-rose-800">
          تعذّر تحميل الفحص التشخيصي.
          {error?.message
            ? ` ${localizeApiErrorMessage(error.message, Number.parseInt(error.code ?? '', 10) || undefined)}`
            : ''}
        </p>
      ) : null}

      <section className={`${DASH_PANEL} mb-5 grid grid-cols-1 gap-5 p-5 lg:grid-cols-[auto_1fr]`}>
        <div className="flex flex-col items-center justify-center gap-3">
          {isLoading && !report ? (
            <div className="h-40 w-40 animate-pulse rounded-full bg-slate-100" />
          ) : (
            <HealthGauge score={report?.companyHealthScore ?? 0} status={report?.status ?? 'stable'} />
          )}
          <span
            className={`rounded-full border px-3 py-1 text-[11px] font-semibold ${statusTone(report?.status ?? 'stable')}`}
          >
            {report?.statusLabel ?? 'جاري التقييم'}
          </span>
        </div>
        <div>
          <div className="mb-2 flex items-center gap-2 text-[#0E79AA]">
            <Activity className="h-4 w-4" />
            <p className="text-sm font-bold text-slate-900">الصحة المؤسسية</p>
          </div>
          <p className="text-[12px] text-slate-500">
            الموديولات المشمولة في الفحص:{' '}
            <span className="font-semibold text-slate-800">
              {(report?.evaluatedModules ?? []).map((row) => row.labelAr).join(' · ') || '—'}
            </span>
          </p>
          {report?.skippedModules.length ? (
            <p className="mt-1 text-[11px] text-slate-400">
              غير مشمول (الرخصة): {report.skippedModules.map((row) => row.labelAr).join(' · ')}
            </p>
          ) : null}
          <p className="mt-3 whitespace-pre-line text-[13px] leading-6 text-slate-700">
            {isLoading && !report ? 'جاري تجميع مؤشرات الموديولات المفعّلة…' : report?.briefing}
          </p>
          <p className="mt-2 text-[10px] text-slate-400">
            آخر فحص {report?.generatedAt ? new Date(report.generatedAt).toLocaleString('ar-EG') : '—'}
          </p>
        </div>
      </section>

      <section className={`${DASH_PANEL} mb-5 p-4`}>
        <h2 className="mb-3 text-sm font-bold text-slate-900">توجيهات الذكاء الاصطناعي التنفيذية</h2>
        {isLoading && !report ? (
          <div className="space-y-2">
            <div className="h-14 animate-pulse rounded-xl bg-slate-100" />
            <div className="h-14 animate-pulse rounded-xl bg-slate-100" />
          </div>
        ) : (
          <ol className="space-y-2">
            {(report?.decisions ?? []).map((decision) => (
              <li key={`${decision.rank}-${decision.href}`} className="flex items-start justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5">
                <div>
                  <p className="text-[13px] font-semibold text-slate-900">
                    <span className="ml-1 font-mono text-[10px] text-[#0E79AA]">{decision.rank}</span>
                    {decision.title}
                  </p>
                  <p className="mt-0.5 text-[11px] text-slate-500">{decision.detail}</p>
                </div>
                <Link
                  href={decision.href}
                  className="shrink-0 rounded-lg bg-[#0E79AA] px-2.5 py-1.5 text-[11px] font-semibold text-white"
                >
                  {decision.actionLabel}
                </Link>
              </li>
            ))}
          </ol>
        )}
      </section>

      <section className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {isLoading && !report ? (
          <>
            <ProbeSkeleton />
            <ProbeSkeleton />
            <ProbeSkeleton />
          </>
        ) : (
          <>
            {probeByKey.get('financial') ? <ProbeCard probe={probeByKey.get('financial')!} /> : null}
            {probeByKey.get('sales') ? <ProbeCard probe={probeByKey.get('sales')!} /> : null}
            {probeByKey.get('inventory') ? <ProbeCard probe={probeByKey.get('inventory')!} /> : null}
            {probeByKey.get('contracting') ? <ProbeCard probe={probeByKey.get('contracting')!} /> : null}
            {probeByKey.get('manufacturing') ? <ProbeCard probe={probeByKey.get('manufacturing')!} /> : null}
            {probeByKey.get('real-estate') ? <ProbeCard probe={probeByKey.get('real-estate')!} /> : null}
            {probeByKey.get('hr') ? <ProbeCard probe={probeByKey.get('hr')!} /> : null}
          </>
        )}
      </section>
    </CommandCenter>
  );
}
