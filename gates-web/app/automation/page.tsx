'use client';

import { useMemo } from 'react';
import { useAutomationRulesQuery } from '@/lib/hooks/useAutomationRules';
import { useAutomationRunsQuery } from '@/lib/hooks/useAutomationRuns';
import { AutomationAgent } from '@/components/automation/AutomationAgent';
import { AutomationCoverage } from '@/components/automation/AutomationCoverage';
import { AutomationOverviewCards } from '@/components/automation/AutomationOverviewCards';
import { AutomationList } from '@/components/automation/AutomationList';
import { AutomationTemplates } from '@/components/automation/AutomationTemplates';
import { useI18n } from '@/lib/i18n';
import type { AutomationRun } from '@/lib/automation/types';

export default function AutomationHomePage() {
  const { t } = useI18n();
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
    <div className="mx-auto flex max-w-6xl flex-col gap-8 p-4 sm:p-6">
      <AutomationAgent />
      <AutomationOverviewCards rules={rules} todayRuns={runs} isLoading={rulesLoading || runsLoading} />
      <AutomationCoverage />
      <AutomationList runsByRuleId={runsByRuleId} />
      {rules.length > 0 ? (
        <section className="flex flex-col gap-3">
          <h2 className="text-lg font-bold text-foreground">{t('automation.startFromTemplate')}</h2>
          <AutomationTemplates />
        </section>
      ) : null}
    </div>
  );
}
