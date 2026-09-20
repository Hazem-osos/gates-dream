'use client';

import { useState } from 'react';
import { CheckCircle2, ChevronDown, Circle, XCircle } from 'lucide-react';
import { MasterEntitySideDrawer } from '@/components/masters/MasterEntitySideDrawer';
import { StatusBadge } from '@/components/ui';
import { describeActionSummary, describeTrigger, formatDurationAr, friendlyRunError, RUN_STATUS_LABEL, runStatusTone } from '@/lib/automation/humanize';
import { findAction } from '@/lib/automation/catalog';
import type { AutomationRun } from '@/lib/automation/types';

type Props = {
  run: AutomationRun | null;
  onClose: () => void;
};

type StepState = 'done' | 'failed' | 'pending';

function Step({ label, state }: { label: string; state: StepState }) {
  const Icon = state === 'done' ? CheckCircle2 : state === 'failed' ? XCircle : Circle;
  const color = state === 'done' ? 'text-emerald-600' : state === 'failed' ? 'text-rose-600' : 'text-slate-300';
  return (
    <div className="flex items-center gap-3">
      <Icon className={`h-5 w-5 shrink-0 ${color}`} aria-hidden />
      <span className={`text-sm font-medium ${state === 'pending' ? 'text-slate-400' : 'text-slate-800'}`}>{label}</span>
    </div>
  );
}

export function AutomationRunDetailsDrawer({ run, onClose }: Props) {
  const [showTechnical, setShowTechnical] = useState(false);
  if (!run) return null;

  const succeeded = run.status === 'SUCCEEDED';
  const failed = run.status === 'FAILED';
  const pending = run.status === 'PENDING';
  const actionDef = findAction(run.actionType);
  const duration = formatDurationAr(run.startedAt, run.completedAt);

  return (
    <MasterEntitySideDrawer
      open={Boolean(run)}
      onClose={onClose}
      title="تفاصيل التشغيل"
      subtitle={run.ruleName ?? undefined}
    >
      <div className="mb-5 flex items-center justify-between">
        <StatusBadge tone={runStatusTone(run.status)} label={RUN_STATUS_LABEL[run.status]} />
        {run.attemptCount > 1 ? (
          <span className="text-xs text-slate-500">المحاولة رقم {run.attemptCount}</span>
        ) : null}
      </div>

      <div className="flex flex-col gap-4 rounded-xl border border-slate-100 bg-[#F6FBFD] p-4">
        <Step label={`تم التشغيل — ${describeTrigger(run.eventType ?? '')}`} state="done" />
        <div className="mr-2.5 h-4 w-px bg-slate-200" aria-hidden />
        <Step label="تم فحص الشروط" state="done" />
        <div className="mr-2.5 h-4 w-px bg-slate-200" aria-hidden />
        <Step
          label={describeActionSummary(run.actionType, undefined) || actionDef?.label || run.actionType}
          state={succeeded ? 'done' : failed ? 'failed' : 'pending'}
        />
        {succeeded ? (
          <>
            <div className="mr-2.5 h-4 w-px bg-slate-200" aria-hidden />
            <Step label="اكتملت العملية" state="done" />
          </>
        ) : null}
      </div>

      {failed ? (
        <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 p-4">
          <p className="text-sm font-semibold text-rose-800">{friendlyRunError(run)}</p>
        </div>
      ) : null}

      {pending ? (
        <p className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          العملية قيد التنفيذ الآن…
        </p>
      ) : null}

      {succeeded && run.resultMetadata && typeof run.resultMetadata.orderNumber === 'string' ? (
        <p className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
          تم إنشاء المستند رقم <span className="font-bold">{run.resultMetadata.orderNumber}</span>
        </p>
      ) : null}

      <div className="mt-5 flex flex-col gap-1.5 text-xs text-slate-500">
        <p>بدأت: {new Date(run.startedAt).toLocaleString('ar-EG')}</p>
        {duration ? <p>المدة: {duration}</p> : null}
      </div>

      {failed && run.errorMessage ? (
        <div className="mt-5 border-t border-slate-100 pt-3">
          <button
            type="button"
            onClick={() => setShowTechnical((v) => !v)}
            className="inline-flex items-center gap-1 text-xs font-semibold text-slate-500 hover:text-slate-700"
          >
            <ChevronDown className={`h-3.5 w-3.5 transition-transform ${showTechnical ? 'rotate-180' : ''}`} aria-hidden />
            تفاصيل تقنية
          </button>
          {showTechnical ? (
            <p className="mt-2 break-words rounded-lg bg-slate-50 p-3 text-[11px] leading-relaxed text-slate-500">
              {run.errorMessage}
            </p>
          ) : null}
        </div>
      ) : null}
    </MasterEntitySideDrawer>
  );
}
