'use client';

import { useApiQuery } from '@/lib/hooks/useApi';
import { queryKeys, staleTimes } from '@/lib/query/query-keys';
import { formatEgp } from '@/lib/subcontracts/money';
import type { ExtractsDashboardSummary } from '@/lib/dashboards/types';
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

export default function ExtractsCommand() {
  const { data, isLoading, isFetching, refetch } = useApiQuery<ExtractsDashboardSummary>(
    queryKeys.extracts.dashboard(),
    '/extracts/dashboard/summary',
    undefined,
    { staleTime: staleTimes.transactionalMs, requireFullTenant: false }
  );
  const s = data?.data;
  const k = s?.kpis;

  return (
    <CommandCenter
      title="المستخلصات — اعتماد ودفع"
      module="EXTRACTS"
      asOf={s?.asOfDate}
      refreshing={isFetching}
      onRefresh={() => void refetch()}
      shortcuts={[
        { key: 'F2', label: 'مستخلص', href: '/extracts/operations/projects/make-extract' },
        { key: 'F4', label: 'سداد', href: '/extracts/operations/extract-payment' },
        { key: 'F6', label: 'مشاريع', href: '/extracts/operations/projects' },
      ]}
    >
      <MetricBar
        loading={isLoading && !s}
        items={[
          { id: 'pv', label: 'قيمة المشاريع', value: <SensitiveValue>{formatEgp(k?.portfolioValue)}</SensitiveValue>, hint: `${k?.activeProjects ?? 0} نشط` },
          { id: 'net', label: 'مستخلصات مرحّلة', value: <SensitiveValue>{formatEgp(k?.postedNetValue)}</SensitiveValue>, hint: `${k?.postedExtracts ?? 0} مستند` },
          { id: 'paid', label: 'مدفوع', value: <SensitiveValue>{formatEgp(k?.totalPaid)}</SensitiveValue>, hint: `${k?.pendingPayments ?? 0} دفعة معلّقة`, tone: (k?.pendingPayments ?? 0) > 0 ? 'warn' : 'ok' },
          { id: 'out', label: 'متبقي مستحق', value: <SensitiveValue>{formatEgp(k?.outstandingPayable)}</SensitiveValue>, tone: (k?.outstandingPayable ?? 0) > 0 ? 'bad' : 'ok' },
          { id: 'draft', label: 'مسودات', value: k?.draftExtracts ?? 0, tone: (k?.draftExtracts ?? 0) > 0 ? 'warn' : 'ok' },
          { id: 'ctr', label: 'مقاولون', value: k?.activeContractors ?? 0, hint: `${k?.workItemAssignments ?? 0} إسناد` },
        ]}
      />

      <div className={DASH_GRID}>
        <div className={DASH_PANEL + ' p-2.5'}>
          <p className="mb-2 text-xs font-semibold">فوترة مقابل سداد</p>
          <GaugeBar actual={k?.totalPaid ?? 0} target={k?.postedNetValue ?? 0} actualLabel="مدفوع" targetLabel="مرحّل" />
          <div className="mt-3">
            <SegmentedBar
              segments={(s?.charts.statusFunnel ?? []).map((r, i) => ({
                label: r.label,
                value: r.value,
                color: ['#D97706', '#059669', '#64748B'][i] ?? '#0E79AA',
              }))}
            />
          </div>
        </div>
        <TriageQueue
          title="بانتظار الترحيل"
          loading={isLoading}
          items={(s?.inbox ?? []).map((item) => ({
            id: item.id,
            title: item.title,
            meta: item.detail,
            amount: item.amount != null ? <SensitiveValue>{formatEgp(item.amount)}</SensitiveValue> : undefined,
            href: item.href,
            tone: item.tone === 'red' ? 'bad' : item.tone === 'amber' ? 'warn' : 'info',
            actions: [{ label: 'ترحيل', href: item.href }],
          }))}
        />
        <DataGridDense
          title="أعلى المشاريع"
          loading={isLoading}
          rows={(s?.charts.topProjects ?? []).map((p) => ({ ...p }))}
          columns={[
            { id: 'n', header: 'المشروع', cell: (r) => (r.serial ? `${r.name} (${r.serial})` : r.name) },
            { id: 'v', header: 'مستخلص', numeric: true, cell: (r) => <SensitiveValue>{formatEgp(r.invoiced)}</SensitiveValue> },
          ]}
        />
      </div>
    </CommandCenter>
  );
}
