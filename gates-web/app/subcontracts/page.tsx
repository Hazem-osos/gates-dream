'use client';

import { useApiQuery } from '@/lib/hooks/useApi';
import { queryKeys, staleTimes } from '@/lib/query/query-keys';
import { formatEgp } from '@/lib/subcontracts/money';
import type { SubcontractDashboardSummary } from '@/lib/dashboards/types';
import { SensitiveValue } from '@/app/components/ui/SensitiveValue';
import {
  CommandCenter,
  MetricBar,
  TriageQueue,
  DataGridDense,
  SegmentedBar,
  GaugeBar,
  DASH_PANEL,
  DASH_GRID,
} from '@/components/dashboard-primitives';

const FUNNEL_AR: Record<string, string> = {
  DRAFT: 'مسودة',
  SITE_SUBMITTED: 'موقع',
  CONSULTANT_APPROVED: 'استشاري',
  TECH_OFFICE_APPROVED: 'مكتب فني',
  FINANCE_POSTED: 'مرحّل',
  PAID: 'مدفوع',
};

export default function SubcontractsCommand() {
  const { data, isLoading, isFetching, refetch } = useApiQuery<SubcontractDashboardSummary>(
    queryKeys.subcontracts.dashboard(),
    '/subcontracts/dashboard/summary',
    undefined,
    { staleTime: staleTimes.transactionalMs, requireFullTenant: false }
  );
  const s = data?.data;
  const k = s?.kpis;

  return (
    <CommandCenter
      title="مقاولو الباطن — تأمين ومنبع 41"
      module="SUBCONTRACTS"
      asOf={s?.asOfDate}
      refreshing={isFetching}
      onRefresh={() => void refetch()}
      shortcuts={[
        { key: 'F2', label: 'عقد باطن', href: '/subcontracts/contracts' },
        { key: 'F4', label: 'مستخلصات', href: '/contracting/extracts' },
      ]}
    >
      <MetricBar
        loading={isLoading && !s}
        items={[
          { id: 'inv', label: 'مستخلص حتى اليوم', value: <SensitiveValue>{formatEgp(k?.invoicedToDate)}</SensitiveValue>, hint: `التزام ${formatEgp(k?.committedValue)}` },
          { id: 'ret', label: 'تأمين محتجز', value: <SensitiveValue>{formatEgp(k?.retentionHeld)}</SensitiveValue>, hint: `${k?.activeSubcontracts ?? 0} عقد` },
          { id: 'pen', label: 'هالك غير مطبّق', value: <SensitiveValue>{formatEgp(k?.unappliedPenalties)}</SensitiveValue>, tone: (k?.unappliedPenalties ?? 0) > 0 ? 'bad' : 'ok' },
          { id: 'f41', label: `منبع 41 ر${k?.form41Quarter ?? '—'}`, value: <SensitiveValue>{formatEgp(k?.form41Withheld)}</SensitiveValue> },
          { id: 'exec', label: 'نسبة التنفيذ', value: `${((k?.executionRatio ?? 0) * 100).toFixed(1)}٪` },
          { id: 'draft', label: 'مسودات غير مرحلة', value: k?.unpostedDrafts ?? 0, tone: (k?.unpostedDrafts ?? 0) > 0 ? 'warn' : 'ok' },
        ]}
      />

      <div className={DASH_GRID}>
        <div className={DASH_PANEL + ' p-2.5'}>
          <p className="mb-2 text-xs font-semibold">تنفيذ مقابل التزام</p>
          <GaugeBar actual={k?.executedGross ?? 0} target={k?.committedValue ?? 0} />
          <div className="mt-3">
            <SegmentedBar
              segments={(s?.charts.approvalFunnel ?? []).map((f, i) => ({
                label: FUNNEL_AR[f.status] ?? f.status,
                value: f.count,
                color: ['#94A3B8', '#D97706', '#0E79AA', '#7C3AED', '#059669'][i] ?? '#64748B',
              }))}
            />
          </div>
        </div>
        <TriageQueue
          title="اعتمادات باطن"
          loading={isLoading}
          items={(s?.inbox ?? []).map((item) => ({
            id: item.id,
            title: item.title,
            meta: item.detail,
            href: item.href,
            tone: item.tone === 'red' ? 'bad' : item.tone === 'amber' ? 'warn' : 'info',
          }))}
        />
        <DataGridDense
          title="أعلى المقاولين"
          loading={isLoading}
          rows={(s?.charts.topSubcontractors ?? []).map((r) => ({ ...r }))}
          columns={[
            { id: 'n', header: 'المقاول', cell: (r) => r.name },
            { id: 'c', header: 'العقد', cell: (r) => r.contractNumber },
            { id: 'v', header: 'مستخلص', numeric: true, cell: (r) => <SensitiveValue>{formatEgp(r.invoiced)}</SensitiveValue> },
          ]}
        />
      </div>
    </CommandCenter>
  );
}
