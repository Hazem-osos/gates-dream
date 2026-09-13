'use client';

import { useApiQuery } from '@/lib/hooks/useApi';
import { queryKeys, staleTimes } from '@/lib/query/query-keys';
import { formatEgp } from '@/lib/real-estate/format';
import type { RealEstateDashboardSummary } from '@/lib/dashboards/types';
import { SensitiveValue } from '@/app/components/ui/SensitiveValue';
import {
  CommandCenter,
  MetricBar,
  TriageQueue,
  DataGridDense,
  SegmentedBar,
  GaugeBar,
  StatusDotPill,
  DASH_PANEL,
  DASH_GRID,
} from '@/components/dashboard-primitives';

export default function RealEstatePortfolioCommand() {
  const { data, isLoading, isFetching, refetch } = useApiQuery<RealEstateDashboardSummary>(
    queryKeys.realEstate.dashboard(),
    '/real-estate/dashboard/summary',
    undefined,
    { staleTime: staleTimes.transactionalMs, requireFullTenant: false }
  );
  const s = data?.data;
  const k = s?.kpis;
  const cash = s?.charts.monthlyCash ?? [];

  return (
    <CommandCenter
      title="المحفظة العقارية — عقود وأقساط"
      module="PORTFOLIO"
      asOf={s?.asOfDate}
      refreshing={isFetching}
      onRefresh={() => void refetch()}
      shortcuts={[
        { key: 'F2', label: 'عقود', href: '/real-estate/contracts' },
        { key: 'F4', label: 'شيكات', href: '/real-estate/cheques' },
        { key: 'F6', label: 'تنازل', href: '/real-estate/resale' },
      ]}
    >
      <MetricBar
        loading={isLoading && !s}
        items={[
          {
            id: 'sales',
            label: 'مبيعات المحفظة',
            value: <SensitiveValue>{formatEgp(k?.portfolioSales)}</SensitiveValue>,
            spark: cash.map((c) => c.expected),
          },
          {
            id: 'col',
            label: 'تحصيل نقدي',
            value: <SensitiveValue>{formatEgp(k?.cashCollected)}</SensitiveValue>,
            hint: `${Math.round((k?.collectionRatio ?? 0) * 100)}٪ نسبة`,
          },
          {
            id: 'od',
            label: 'أقساط متأخرة',
            value: k?.overdueCount ?? 0,
            hint: <SensitiveValue>{formatEgp(k?.overdueDebt)}</SensitiveValue>,
            tone: (k?.overdueCount ?? 0) > 0 ? 'bad' : 'ok',
          },
          {
            id: 'pdc',
            label: 'شيكات تحت التحصيل',
            value: <SensitiveValue>{formatEgp(k?.chequesUnderCollection)}</SensitiveValue>,
            hint: `مرتد ${s?.cheques.bounced.count ?? 0}`,
            tone: (s?.cheques.bounced.count ?? 0) > 0 ? 'bad' : 'neutral',
          },
          {
            id: '60',
            label: '+60 يوم',
            value: k?.overdueOver60Count ?? 0,
            hint: <SensitiveValue>{formatEgp(k?.overdueOver60Debt)}</SensitiveValue>,
            tone: (k?.overdueOver60Count ?? 0) > 0 ? 'bad' : 'ok',
          },
          {
            id: 'rs',
            label: 'تنازلات معلّقة',
            value: k?.resalePendingClearance ?? 0,
            tone: (k?.resalePendingClearance ?? 0) > 0 ? 'warn' : 'ok',
          },
        ]}
      />

      <div className={DASH_GRID}>
        <div className={DASH_PANEL + ' p-2.5'}>
          <p className="mb-2 text-xs font-semibold">نسبة التحصيل</p>
          <GaugeBar actual={k?.cashCollected ?? 0} target={k?.portfolioSales ?? 0} />
          <div className="mt-3">
            <SegmentedBar
              segments={[
                { label: 'حفظ', value: s?.cheques.custody.count ?? 0, color: '#64748B' },
                { label: 'تحصيل', value: s?.cheques.underCollection.count ?? 0, color: '#0E79AA' },
                { label: 'محصّل', value: s?.cheques.cleared.count ?? 0, color: '#059669' },
                { label: 'مرتد', value: s?.cheques.bounced.count ?? 0, color: '#E11D48' },
              ]}
            />
          </div>
        </div>
        <TriageQueue
          title="صندوق المتابعة"
          loading={isLoading}
          items={(s?.inbox ?? []).map((item) => ({
            id: item.id,
            title: item.title,
            meta: item.detail,
            amount: item.amount != null ? <SensitiveValue>{formatEgp(item.amount)}</SensitiveValue> : undefined,
            href: item.href,
            tone: item.tone === 'red' ? 'bad' : item.tone === 'amber' ? 'warn' : 'info',
          }))}
        />
        <DataGridDense
          title="آخر النشاط"
          loading={isLoading}
          rows={(s?.activity ?? []).map((a) => ({ ...a }))}
          onRowOpen={(r) => {
            window.location.href = r.href;
          }}
          columns={[
            { id: 't', header: 'العملية', cell: (r) => r.title },
            { id: 'd', header: 'التفاصيل', cell: (r) => r.detail },
            {
              id: 's',
              header: 'الحالة',
              cell: (r) => <StatusDotPill label={r.status} tone="info" />,
            },
            { id: 'at', header: 'التاريخ', cell: (r) => r.at.slice(0, 10) },
          ]}
        />
      </div>
    </CommandCenter>
  );
}
