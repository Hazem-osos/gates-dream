'use client';

import { useApiQuery } from '@/lib/hooks/useApi';
import { queryKeys, staleTimes } from '@/lib/query/query-keys';
import { formatEgp } from '@/lib/subcontracts/money';
import type { ContractingDashboardSummary } from '@/lib/dashboards/types';
import { SensitiveValue } from '@/app/components/ui/SensitiveValue';
import {
  CommandCenter,
  MetricBar,
  TriageQueue,
  DataGridDense,
  SegmentedBar,
  GaugeBar,
  DASH_PANEL,
  DASH_NUM,
  DASH_GRID,
} from '@/components/dashboard-primitives';

const EXTRACT_AR: Record<string, string> = {
  DRAFT: 'مسودة',
  SITE_SUBMITTED: 'موقع',
  TECH_OFFICE_APPROVED: 'مكتب فني',
  CLIENT_APPROVED: 'عميل',
  FINANCE_POSTED: 'مرحّل',
  PAID: 'مدفوع',
};

export default function ContractingCommand() {
  const { data, isLoading, isFetching, refetch } = useApiQuery<ContractingDashboardSummary>(
    queryKeys.contracting.dashboard(),
    '/contracting/dashboard/summary',
    undefined,
    { staleTime: staleTimes.transactionalMs, requireFullTenant: false }
  );
  const s = data?.data;
  const k = s?.kpis;
  const billing = s?.charts.monthlyBilling ?? [];
  const completion =
    k?.budgetAtCompletion && k.budgetAtCompletion > 0
      ? Math.round((k.earnedValue / k.budgetAtCompletion) * 100)
      : 0;

  return (
    <CommandCenter
      title="المقاولات والمستخلصات — مصفوفة التنفيذ"
      module="CONTRACTING"
      asOf={s?.asOfDate}
      refreshing={isFetching}
      onRefresh={() => void refetch()}
      shortcuts={[
        { key: 'F2', label: 'مستخلص', href: '/contracting/extracts' },
        { key: 'F4', label: 'مشروع', href: '/contracting/projects' },
        { key: 'F6', label: 'باطن', href: '/subcontracts/contracts' },
      ]}
    >
      <MetricBar
        loading={isLoading && !s}
        items={[
          { id: 'val', label: 'عقود جارية', value: <SensitiveValue>{formatEgp(k?.activeContractValue)}</SensitiveValue>, hint: `${k?.activeProjects ?? 0} مشروع`, spark: billing.map((b) => b.billed) },
          { id: 'pend', label: 'مستخلصات معلّقة', value: s?.actionQueue.pendingClientExtracts ?? 0, hint: `${s?.actionQueue.unapprovedMeasurementSheets ?? 0} حصر`, tone: (s?.actionQueue.pendingClientExtracts ?? 0) > 0 ? 'warn' : 'ok' },
          { id: 'lg', label: 'ضمان محتجز', value: <SensitiveValue>{formatEgp(k?.lgFrozenMargin)}</SensitiveValue>, hint: `${k?.lgActiveCount ?? 0} خطاب` },
          { id: 'cpi', label: 'CPI', value: k?.portfolioCpi?.toFixed(2) ?? '—', tone: (k?.portfolioCpi ?? 1) < 1 ? 'bad' : 'ok' },
          { id: 'spi', label: 'SPI', value: k?.portfolioSpi?.toFixed(2) ?? '—', tone: (k?.portfolioSpi ?? 1) < 1 ? 'warn' : 'ok' },
          { id: 'ev', label: 'إنجاز مالي', value: `${completion}٪`, hint: <SensitiveValue>{formatEgp(k?.earnedValue)}</SensitiveValue> },
        ]}
      />

      <div className={DASH_GRID}>
        <div className={DASH_PANEL + ' p-2.5'}>
          <p className="mb-2 text-xs font-semibold">تنفيذ مقابل فوترة</p>
          <GaugeBar actual={k?.earnedValue ?? 0} target={k?.budgetAtCompletion ?? 0} actualLabel="مكتسب" targetLabel="BAC" />
          <div className="mt-3">
            <SegmentedBar
              segments={(s?.extractPipeline ?? []).slice(0, 5).map((p, i) => ({
                label: EXTRACT_AR[p.status] ?? p.status,
                value: p.count,
                color: ['#94A3B8', '#D97706', '#0E79AA', '#0284C7', '#059669'][i] ?? '#64748B',
              }))}
            />
          </div>
          <p className={'mt-2 ' + DASH_NUM + ' text-[10px] text-slate-500'}>
            انحراف تكلفة {k?.costVariance != null ? formatEgp(k.costVariance) : '—'}
          </p>
        </div>
        <TriageQueue
          title="مستخلصات قيد الاعتماد"
          loading={isLoading}
          items={(s?.inbox ?? []).map((item) => ({
            id: item.id,
            title: item.title,
            meta: item.detail,
            amount: item.amount != null ? <SensitiveValue>{formatEgp(item.amount)}</SensitiveValue> : undefined,
            href: item.href,
            tone: item.tone === 'red' ? 'bad' : item.tone === 'amber' ? 'warn' : 'info',
            actions: [{ label: 'فتح', href: item.href }],
          }))}
        />
        <DataGridDense
          title="توزيع التكلفة"
          loading={isLoading}
          rows={(s?.charts.costDistribution ?? []).map((r, i) => ({ id: r.key || String(i), ...r }))}
          columns={[
            { id: 'l', header: 'البند', cell: (r) => r.label },
            { id: 'v', header: 'القيمة', numeric: true, cell: (r) => <SensitiveValue>{formatEgp(r.value)}</SensitiveValue> },
          ]}
        />
      </div>
    </CommandCenter>
  );
}
