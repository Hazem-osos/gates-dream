'use client';

import { useMemo } from 'react';
import { CheckCircle2, PlayCircle, TriangleAlert, Zap } from 'lucide-react';
import { KpiSummaryCard, ModuleKpiGrid, MetricCardsSkeleton } from '@/components/ui';
import type { AutomationRule, AutomationRun } from '@/lib/automation/types';

type Props = {
  rules: AutomationRule[];
  todayRuns: AutomationRun[];
  isLoading: boolean;
};

function isToday(iso: string): boolean {
  const d = new Date(iso);
  const now = new Date();
  return (
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate()
  );
}

export function AutomationOverviewCards({ rules, todayRuns, isLoading }: Props) {
  const stats = useMemo(() => {
    const active = rules.filter((r) => r.enabled).length;
    const runsToday = todayRuns.filter((r) => isToday(r.startedAt));
    const succeeded = runsToday.filter((r) => r.status === 'SUCCEEDED').length;
    const failed = runsToday.filter((r) => r.status === 'FAILED').length;
    return { active, runsToday: runsToday.length, succeeded, failed };
  }, [rules, todayRuns]);

  if (isLoading) return <MetricCardsSkeleton count={4} />;

  return (
    <ModuleKpiGrid>
      <KpiSummaryCard label="أتمتة نشطة" value={stats.active} icon={Zap} />
      <KpiSummaryCard label="عمليات اليوم" value={stats.runsToday} icon={PlayCircle} />
      <KpiSummaryCard
        label="نجحت اليوم"
        value={stats.succeeded}
        icon={CheckCircle2}
        trend={stats.runsToday > 0 ? `${Math.round((stats.succeeded / stats.runsToday) * 100)}%` : undefined}
        trendTone="up"
      />
      <KpiSummaryCard
        label="تحتاج مراجعة"
        value={stats.failed}
        icon={TriangleAlert}
        trendTone={stats.failed > 0 ? 'down' : 'neutral'}
      />
    </ModuleKpiGrid>
  );
}
