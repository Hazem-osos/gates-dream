'use client';

import { useState } from 'react';
import { CheckCircle2, Circle, XCircle } from 'lucide-react';
import { EmptyState, Skeleton } from '@/components/ui';
import { useAutomationRunsQuery } from '@/lib/hooks/useAutomationRuns';
import { groupAutomationRuns } from '@/lib/automation/group-runs';
import { describeActionLabel, describeTrigger, formatRelativeTime, runStatusLabel } from '@/lib/automation/humanize';
import type { AutomationRun, AutomationRunStatus } from '@/lib/automation/types';
import { useAutomationMetadataQuery } from '@/lib/hooks/useAutomationRules';
import { useI18n } from '@/lib/i18n';
import { AutomationRunDetailsDrawer } from './AutomationRunDetailsDrawer';

function RunIcon({ status }: { status: AutomationRunStatus }) {
  if (status === 'SUCCEEDED') return <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" aria-hidden />;
  if (status === 'FAILED') return <XCircle className="h-4 w-4 shrink-0 text-rose-600" aria-hidden />;
  return <Circle className="h-4 w-4 shrink-0 text-amber-500" aria-hidden />;
}

export function AutomationHistoryList({ ruleId }: { ruleId: string }) {
  const { t, locale } = useI18n();
  const { data, isLoading, isError } = useAutomationRunsQuery({ ruleId, limit: 100 });
  const { data: metadataResult } = useAutomationMetadataQuery();
  const metadata = metadataResult?.data;
  const runs = data?.data ?? [];
  const groups = groupAutomationRuns(runs);
  const [selectedRun, setSelectedRun] = useState<AutomationRun | null>(null);

  if (isLoading) {
    return (
      <div className="flex flex-col gap-2" role="status" aria-busy="true" aria-label={t('automation.historyLoading')}>
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-16 w-full rounded-xl" />
        ))}
      </div>
    );
  }

  if (isError) {
    return <p className="text-sm text-danger">{t('automation.loadError')}</p>;
  }

  if (groups.length === 0) {
    return <EmptyState title={t('automation.historyEmptyTitle')} description={t('automation.historyEmptyBody')} />;
  }

  return (
    <>
      <div className="flex flex-col gap-3">
        {groups.map((group) => {
          const mixed = group.runs.some((run) => run.status === 'FAILED') && group.runs.some((run) => run.status === 'SUCCEEDED');
          return (
            <section key={group.key} className="rounded-xl border border-border bg-surface-1 p-3">
              <div className="mb-2">
                <p className="text-sm font-bold text-foreground">{describeTrigger(t, metadata, group.eventType)}</p>
                <p className="text-xs text-foreground-muted">
                  {group.ruleName ? `${t('automation.ruleLabel')} ${group.ruleName}` : null}
                  {group.ruleName ? ' · ' : ''}
                  {formatRelativeTime(group.startedAt, locale)}
                </p>
              </div>
              <div className="flex flex-col gap-1 border-s border-primary/20 ps-3">
                {group.runs.map((run) => (
                  <button
                    key={run.id}
                    type="button"
                    onClick={() => setSelectedRun(run)}
                    className="flex items-center justify-between gap-3 rounded-lg px-2 py-1.5 text-start hover:bg-surface-2"
                  >
                    <span className="flex min-w-0 items-center gap-2">
                      <RunIcon status={run.status} />
                      <span className="truncate text-sm font-medium text-foreground">
                        {describeActionLabel(t, metadata, run.actionType)}
                      </span>
                    </span>
                    <span className="shrink-0 text-xs text-foreground-muted">{runStatusLabel(t, run.status)}</span>
                  </button>
                ))}
              </div>
              {mixed ? <p className="mt-2 text-[11px] text-foreground-muted">{t('automation.independentActions')}</p> : null}
            </section>
          );
        })}
      </div>
      <AutomationRunDetailsDrawer run={selectedRun} onClose={() => setSelectedRun(null)} />
    </>
  );
}
