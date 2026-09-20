'use client';

import { useMemo } from 'react';
import { useAutomationRulesQuery } from '@/lib/hooks/useAutomationRules';
import { useAutomationRunsQuery } from '@/lib/hooks/useAutomationRuns';
import { AutomationHero } from '@/components/automation/AutomationHero';
import { AutomationOverviewCards } from '@/components/automation/AutomationOverviewCards';
import { AutomationList } from '@/components/automation/AutomationList';
import type { AutomationRun } from '@/lib/automation/types';

export default function AutomationHomePage() {
  const { data: rulesData, isLoading: rulesLoading } = useAutomationRulesQuery({ limit: 100 });
  const rules = rulesData?.data ?? [];

  // "Runs today" and "last run per rule" are both derived from one recent-runs
  // fetch — no separate metrics endpoint exists, and we do not fabricate one.
  const { data: runsData, isLoading: runsLoading } = useAutomationRunsQuery({ limit: 100 });
  const runs = runsData?.data ?? [];

  const runsByRuleId = useMemo(() => {
    const map = new Map<string, AutomationRun>();
    // runs are ordered newest-first by the backend; first hit per ruleId wins.
    for (const run of runs) {
      if (!map.has(run.ruleId)) map.set(run.ruleId, run);
    }
    return map;
  }, [runs]);

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6 p-4 sm:p-6" dir="rtl">
      <AutomationHero />
      <AutomationOverviewCards rules={rules} todayRuns={runs} isLoading={rulesLoading || runsLoading} />
      <AutomationList runsByRuleId={runsByRuleId} />
    </div>
  );
}
