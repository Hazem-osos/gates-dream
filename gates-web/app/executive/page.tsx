'use client';

import { useMemo, useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import {
  formatMoney,
  trendPctLabel,
  useExecutiveAnalytics,
  useExecutiveOverview,
  useExecutiveRiskFeed,
  type ExecutiveRiskFlag,
} from '@/lib/hooks/useExecutiveDashboard';
import { useBackendReachability } from '@/lib/hooks/useBackendReachability';
import { SensitiveValue } from '@/app/components/ui/SensitiveValue';
import { usePrivacyMode } from '@/lib/providers/PrivacyModeProvider';
import { LaunchChecklistWidget } from '@/components/onboarding/LaunchChecklistWidget';
import { SentinelRiskButton } from '@/components/ai/SentinelRiskButton';
import {
  CommandCenter,
  MetricBar,
  TriageQueue,
  DataGridDense,
  SegmentedBar,
  GaugeBar,
  DASH_PANEL,
  DASH_NUM,
  HUD_BTN_GHOST,
  HUD_SEGMENT,
  HUD_SEGMENT_OFF,
  HUD_SEGMENT_ON,
} from '@/components/dashboard-primitives';

export default function ExecutiveCockpitPage() {
  useBackendReachability();
  const { privacyMode, togglePrivacyMode } = usePrivacyMode();
  const { data: overviewRes, isLoading, isFetching, isError, refetch } = useExecutiveOverview();
  const { data: riskRes } = useExecutiveRiskFeed();
  const { data: analyticsRes } = useExecutiveAnalytics();
  const overview = overviewRes?.data;
  const analytics = analyticsRes?.data;
  const flags = riskRes?.data?.flags ?? [];

  const [basis, setBasis] = useState<'accrual' | 'cash'>('accrual');
  const revenue = basis === 'accrual' ? overview?.monthlyPerformance.revenue ?? 0 : overview?.monthlyCashFlow.at(-1)?.inflow ?? 0;

  const triage = useMemo(
    () =>
      flags.map((f: ExecutiveRiskFlag) => ({
        id: f.id,
        title: f.title,
        meta: f.detail,
        href: f.href,
        tone: (f.severity === 'high' ? 'bad' : f.severity === 'medium' ? 'warn' : 'info') as 'bad' | 'warn' | 'info',
        actions: f.href ? [{ label: f.actionLabel ?? 'فتح', href: f.href }] : undefined,
      })),
    [flags]
  );

  return (
    <CommandCenter
      title="الإدارة العليا — سيولة واعتمادات وشذوذات"
      module="C-SUITE"
      asOf={overview?.asOf}
      refreshing={isFetching}
      onRefresh={() => void refetch()}
      shortcuts={[
        { key: 'F8', label: 'التشغيل', href: '/' },
        { key: 'F9', label: 'المشخّص', href: '/diagnostic' },
        { key: 'F7', label: 'النمو', href: '/growth' },
      ]}
      filters={
        <div className="flex flex-wrap items-center gap-2">
          <SentinelRiskButton />
          <div className={HUD_SEGMENT} role="group" aria-label="أساس القياس">
            <button
              type="button"
              onClick={() => setBasis('accrual')}
              className={basis === 'accrual' ? HUD_SEGMENT_ON : HUD_SEGMENT_OFF}
              aria-pressed={basis === 'accrual'}
            >
              استحقاق
            </button>
            <button
              type="button"
              onClick={() => setBasis('cash')}
              className={basis === 'cash' ? HUD_SEGMENT_ON : HUD_SEGMENT_OFF}
              aria-pressed={basis === 'cash'}
            >
              نقدي
            </button>
          </div>
          <button
            type="button"
            onClick={togglePrivacyMode}
            aria-pressed={privacyMode}
            className={
              privacyMode
                ? `${HUD_BTN_GHOST} border-slate-700/80 bg-slate-800 text-white shadow-sm hover:border-slate-700 hover:bg-slate-900 hover:text-white`
                : HUD_BTN_GHOST
            }
          >
            {privacyMode ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
            خصوصية
          </button>
        </div>
      }
    >
      <LaunchChecklistWidget />
      {isError ? (
        <p className="mb-2 border border-rose-200 bg-rose-50 px-2.5 py-1.5 text-[11px] text-rose-800">تعذّر تحميل لوحة الإدارة.</p>
      ) : null}

      <MetricBar
        loading={isLoading && !overview}
        items={[
          {
            id: 'liq',
            label: 'سيولة فعلية',
            value: <SensitiveValue>{formatMoney(overview?.liquidity.netAvailable ?? 0)}</SensitiveValue>,
            hint: `خزن ${formatMoney(overview?.liquidity.safes ?? 0)} · بنك ${formatMoney(overview?.liquidity.banks ?? 0)}`,
            spark: overview?.liquidity.sparkline,
          },
          {
            id: 'rev',
            label: basis === 'accrual' ? 'إيراد استحقاق' : 'تدفق نقدي',
            value: <SensitiveValue>{formatMoney(revenue)}</SensitiveValue>,
            hint: overview ? trendPctLabel(overview.monthlyPerformance.revenueGrowthPctVsLastMonth) : undefined,
            spark: overview?.monthlyPerformance.sparkline,
          },
          {
            id: 'gm',
            label: 'هامش إجمالي',
            value: `${overview?.monthlyPerformance.grossMarginPct.toFixed(1) ?? '—'}٪`,
            hint: <SensitiveValue>{formatMoney(overview?.monthlyPerformance.grossProfit ?? 0)}</SensitiveValue>,
          },
          {
            id: 'ar',
            label: 'ذمم +60',
            value: <SensitiveValue>{formatMoney(overview?.receivables.overdueOver60Days ?? 0)}</SensitiveValue>,
            tone: (overview?.receivables.overdueOver60Days ?? 0) > 0 ? 'bad' : 'ok',
          },
          {
            id: 'chq',
            label: 'شيكات 7ي',
            value: <SensitiveValue>{formatMoney(overview?.chequesPipeline.outwardDueNext7Days.amount ?? 0)}</SensitiveValue>,
            hint: `${overview?.chequesPipeline.outwardDueNext7Days.count ?? 0} صادر`,
          },
          {
            id: 'risk',
            label: 'أعلام مخاطر',
            value: flags.length,
            tone: flags.some((f) => f.severity === 'high') ? 'bad' : 'ok',
          },
        ]}
      />

      <div className="mb-5 grid grid-cols-1 gap-5 lg:grid-cols-3">
        <div className={DASH_PANEL + ' p-2.5'}>
          <p className="mb-2 text-xs font-semibold">هدف مبيعات اليوم</p>
          <GaugeBar
            actual={overview?.dailyMilestone?.todaySales ?? 0}
            target={overview?.dailyMilestone?.dailySalesTarget ?? 0}
            actualLabel="اليوم"
            targetLabel="الهدف"
          />
          <div className="mt-3">
            <SegmentedBar
              segments={[
                { label: 'ذمم جارية', value: overview?.receivables.current ?? 0, color: '#059669' },
                { label: '+60', value: overview?.receivables.overdueOver60Days ?? 0, color: '#E11D48' },
              ]}
            />
          </div>
        </div>
        <TriageQueue title="اعتمادات وشذوذات" loading={isLoading} items={triage} />
        <DataGridDense
          title="مراكز التكلفة"
          rows={(analytics?.costCenterRanking ?? []).slice(0, 8).map((c) => ({ id: c.costCenterId, ...c }))}
          columns={[
            { id: 'n', header: 'المركز', cell: (r) => r.name },
            { id: 'p', header: 'ربح', numeric: true, cell: (r) => <span className={DASH_NUM}><SensitiveValue>{formatMoney(r.profit)}</SensitiveValue></span> },
            {
              id: 'u',
              header: 'ميزانية',
              numeric: true,
              cell: (r) => (r.budgetUtilizationPct != null ? `${r.budgetUtilizationPct.toFixed(0)}٪` : '—'),
            },
          ]}
        />
      </div>
    </CommandCenter>
  );
}
