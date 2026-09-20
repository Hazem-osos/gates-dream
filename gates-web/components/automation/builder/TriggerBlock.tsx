'use client';

import { useState } from 'react';
import { Pencil, Zap } from 'lucide-react';
import { findTrigger, type AutomationTriggerDef } from '@/lib/automation/catalog';
import { TriggerPickerDialog } from './TriggerPickerDialog';

type Props = {
  eventType: string | null;
  onChange: (trigger: AutomationTriggerDef) => void;
  readOnly?: boolean;
};

export function TriggerBlock({ eventType, onChange, readOnly }: Props) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const trigger = findTrigger(eventType ?? undefined);
  const Icon = trigger?.icon ?? Zap;

  return (
    <div className="flex flex-col gap-2">
      <span className="text-xs font-bold uppercase tracking-wide text-slate-400">عندما (WHEN)</span>
      {trigger ? (
        <div className="flex items-start justify-between gap-3 rounded-2xl border-2 border-[#0E78AA]/25 bg-[#F6FBFD] p-4">
          <div className="flex items-start gap-3">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#0E78AA] text-white">
              <Icon className="h-5 w-5" aria-hidden />
            </span>
            <div>
              <p className="text-sm font-bold text-slate-900">{trigger.label}</p>
              <p className="mt-0.5 text-xs text-slate-500">{trigger.description}</p>
            </div>
          </div>
          {!readOnly ? (
            <button
              type="button"
              onClick={() => setPickerOpen(true)}
              className="inline-flex shrink-0 items-center gap-1 rounded-lg px-2 py-1 text-xs font-semibold text-[#0E78AA] hover:bg-white"
            >
              <Pencil className="h-3.5 w-3.5" aria-hidden />
              تغيير
            </button>
          ) : null}
        </div>
      ) : (
        <button
          type="button"
          disabled={readOnly}
          onClick={() => setPickerOpen(true)}
          className="flex items-center gap-3 rounded-2xl border-2 border-dashed border-slate-300 bg-white p-4 text-right transition hover:border-[#0E78AA] hover:bg-[#F6FBFD] disabled:cursor-not-allowed disabled:opacity-60"
        >
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-400">
            <Zap className="h-5 w-5" aria-hidden />
          </span>
          <span className="text-sm font-semibold text-slate-500">اختر ما يبدأ هذه الأتمتة</span>
        </button>
      )}

      <TriggerPickerDialog
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onSelect={(next) => onChange(next)}
      />
    </div>
  );
}
