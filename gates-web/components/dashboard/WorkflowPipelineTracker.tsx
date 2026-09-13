'use client';

import { cn } from '@/lib/utils';
import { DASHBOARD_CARD_CLASS } from './chrome';
import type { PipelineStage } from './types';

export function WorkflowPipelineTracker({
  title = 'مسار العمل',
  stages,
  className,
}: {
  title?: string;
  stages: PipelineStage[];
  className?: string;
}) {
  const activeId = [...stages].reverse().find((s) => s.count > 0)?.id ?? stages[0]?.id;
  return (
    <section className={cn(DASHBOARD_CARD_CLASS, 'p-4', className)} dir="rtl">
      <h2 className="mb-4 text-sm font-semibold text-slate-900">{title}</h2>
      <ol className="flex flex-wrap items-stretch gap-0 overflow-x-auto">
        {stages.map((stage, index) => {
          const active = stage.id === activeId;
          const pending = Boolean(stage.pending) || (stage.count > 0 && !active && index < stages.length - 1);
          return (
            <li key={stage.id} className="flex min-w-[8.5rem] flex-1 items-center">
              <div
                className={cn(
                  'w-full rounded-lg border px-3 py-2.5',
                  active
                    ? 'border-[#0E79AA]/30 bg-[#0E79AA]/5'
                    : 'border-slate-200/75 bg-slate-50/80'
                )}
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs font-medium text-slate-600">{stage.label}</p>
                  {pending ? (
                    <span className="h-2 w-2 rounded-full bg-amber-500 animate-pulse" aria-label="بانتظار اعتماد" />
                  ) : null}
                </div>
                <span className="mt-1.5 inline-flex rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-700 font-mono tabular-nums">
                  {stage.count}
                </span>
                <div
                  className={cn(
                    'mt-2 h-0.5 rounded-full',
                    active ? 'bg-[#0E79AA]' : 'bg-slate-200'
                  )}
                />
              </div>
              {index < stages.length - 1 ? (
                <span
                  className="mx-1 hidden h-0 w-0 border-y-[6px] border-y-transparent border-s-[7px] border-s-slate-200 sm:block"
                  aria-hidden
                />
              ) : null}
            </li>
          );
        })}
      </ol>
    </section>
  );
}
