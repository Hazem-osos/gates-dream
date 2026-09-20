'use client';

import { useState } from 'react';
import { CheckCircle2, Circle, XCircle } from 'lucide-react';
import { EmptyState, Skeleton } from '@/components/ui';
import { useAutomationRunsQuery } from '@/lib/hooks/useAutomationRuns';
import { formatDurationAr, formatRelativeTimeAr, friendlyRunError, RUN_STATUS_LABEL } from '@/lib/automation/humanize';
import type { AutomationRun } from '@/lib/automation/types';
import { AutomationRunDetailsDrawer } from './AutomationRunDetailsDrawer';

function RunIcon({ status }: { status: AutomationRun['status'] }) {
  if (status === 'SUCCEEDED') return <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-600" aria-hidden />;
  if (status === 'FAILED') return <XCircle className="h-5 w-5 shrink-0 text-rose-600" aria-hidden />;
  return <Circle className="h-5 w-5 shrink-0 text-amber-500" aria-hidden />;
}

export function AutomationHistoryList({ ruleId }: { ruleId: string }) {
  const { data, isLoading } = useAutomationRunsQuery({ ruleId, limit: 25 });
  const runs = data?.data ?? [];
  const [selectedRun, setSelectedRun] = useState<AutomationRun | null>(null);

  if (isLoading) {
    return (
      <div className="flex flex-col gap-2" role="status" aria-busy="true" aria-label="جاري تحميل السجل">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-14 w-full rounded-xl" />
        ))}
      </div>
    );
  }

  if (runs.length === 0) {
    return <EmptyState title="لا يوجد سجل تشغيل بعد" description="سيظهر هنا كل تشغيل لهذه الأتمتة بمجرد حدوثه." />;
  }

  return (
    <>
      <div className="flex flex-col gap-2">
        {runs.map((run) => {
          const duration = formatDurationAr(run.startedAt, run.completedAt);
          return (
            <button
              key={run.id}
              type="button"
              onClick={() => setSelectedRun(run)}
              className="flex items-center justify-between gap-3 rounded-xl border border-slate-200/80 bg-white p-3.5 text-right transition hover:border-[#0E78AA]/40 hover:bg-[#F6FBFD]"
            >
              <div className="flex min-w-0 items-center gap-3">
                <RunIcon status={run.status} />
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-slate-800">
                    {run.status === 'FAILED' ? friendlyRunError(run) : RUN_STATUS_LABEL[run.status]}
                  </p>
                  <p className="text-xs text-slate-500">
                    {formatRelativeTimeAr(run.startedAt)}
                    {duration ? ` · اكتملت في ${duration}` : ''}
                  </p>
                </div>
              </div>
            </button>
          );
        })}
      </div>
      <AutomationRunDetailsDrawer run={selectedRun} onClose={() => setSelectedRun(null)} />
    </>
  );
}
