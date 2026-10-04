'use client';

import { useMemo } from 'react';
import { CheckCircle2, PlayCircle, TriangleAlert, Zap } from 'lucide-react';
import { KpiSummaryCard, ModuleKpiGrid, MetricCardsSkeleton } from '@/components/ui';
import { SegmentedBar } from '@/components/dashboard-primitives';
import type { AutomationRule, AutomationRun } from '@/lib/automation/types';
import { useI18n } from '@/lib/i18n';

type Props = {
  rules: AutomationRule[];
  todayRuns: AutomationRun[];
  isLoading: boolean;
};

function isToday(iso: string): boolean {
  const d = new Date(iso);
  const now = new Date();
  return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && d.getDate() === now.getDate();
}

export function AutomationOverviewCards({ rules, todayRuns, isLoading }: Props) {
  const { t } = useI18n();
  const stats = useMemo(() => {
    const active = rules.filter((rule) => rule.enabled).length;
    const runsToday = todayRuns.filter((run) => isToday(run.startedAt));
    const succeeded = runsToday.filter((run) => run.status === 'SUCCEEDED').length;
    const failed = runsToday.filter((run) => run.status === 'FAILED').length;
    return { active, runsToday: runsToday.length, succeeded, failed };
  }, [rules, todayRuns]);

  if (isLoading) return <MetricCardsSkeleton count={4} />;

  return (
    <div className="flex flex-col gap-2">
      <ModuleKpiGrid>
        <KpiSummaryCard label={t('automation.kpiActive')} value={stats.active} icon={Zap} />
        <KpiSummaryCard label={t('automation.kpiRuns')} value={stats.runsToday} icon={PlayCircle} />
        <KpiSummaryCard
          label={t('automation.kpiSucceeded')}
          value={stats.succeeded}
          icon={CheckCircle2}
          trend={stats.runsToday > 0 ? `${Math.round((stats.succeeded / stats.runsToday) * 100)}%` : undefined}
          trendTone="up"
        />
        <KpiSummaryCard
          label={t('automation.kpiFailed')}
          value={stats.failed}
          icon={TriangleAlert}
          trendTone={stats.failed > 0 ? 'down' : 'neutral'}
        />
      </ModuleKpiGrid>
      <div className="rounded-xl border border-[#D6EAF3] bg-white p-4">
        <p className="mb-2 text-sm font-semibold text-[#094C6B]">القواعد والتشغيل</p>
        <SegmentedBar
          segments={[
            { label: 'قواعد مفعّلة', value: stats.active, color: '#0E78AA' },
            { label: 'قواعد متوقفة', value: Math.max(0, rules.length - stats.active), color: '#94A3B8' },
            { label: 'تشغيل ناجح اليوم', value: stats.succeeded, color: '#059669' },
            { label: 'تشغيل فشل اليوم', value: stats.failed, color: '#D64550' },
          ]}
        />
      </div>
      <p className="text-xs text-foreground-muted">{t('automation.kpiSample')}</p>
    </div>
  );
}
