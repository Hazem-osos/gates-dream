'use client';

import { useState } from 'react';
import { Plus, Trash2, Zap } from 'lucide-react';
import { findAction, type AutomationActionDef } from '@/lib/automation/catalog';
import type { AutomationAction } from '@/lib/automation/types';
import { ActionConfigForm } from './ActionConfigForm';
import { ActionPickerDialog } from './ActionPickerDialog';

type Props = {
  actions: AutomationAction[];
  onChange: (actions: AutomationAction[]) => void;
  readOnly?: boolean;
};

export function ActionBlock({ actions, onChange, readOnly }: Props) {
  const [pickerOpen, setPickerOpen] = useState(false);

  const addAction = (def: AutomationActionDef) => {
    onChange([...actions, { type: def.actionType, config: {} }]);
  };

  const removeAction = (index: number) => {
    onChange(actions.filter((_, i) => i !== index));
  };

  const updateConfig = (index: number, config: Record<string, unknown>) => {
    onChange(actions.map((a, i) => (i === index ? { ...a, config } : a)));
  };

  return (
    <div className="flex flex-col gap-2">
      <span className="text-xs font-bold uppercase tracking-wide text-slate-400">نفّذ هذا (THEN)</span>

      {actions.length === 0 ? (
        <button
          type="button"
          disabled={readOnly}
          onClick={() => setPickerOpen(true)}
          className="flex items-center gap-3 rounded-2xl border-2 border-dashed border-slate-300 bg-white p-4 text-right transition hover:border-[#0E78AA] hover:bg-[#F6FBFD] disabled:cursor-not-allowed disabled:opacity-60"
        >
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-400">
            <Zap className="h-5 w-5" aria-hidden />
          </span>
          <span className="text-sm font-semibold text-slate-500">اختر ما يجب أن تفعله GATES</span>
        </button>
      ) : (
        <div className="flex flex-col gap-3">
          {actions.map((action, index) => {
            const def = findAction(action.type);
            const Icon = def?.icon ?? Zap;
            return (
              <div
                key={`${action.type}-${index}`}
                className="rounded-2xl border-2 border-[#0E78AA]/25 bg-[#F6FBFD] p-4"
              >
                <div className="mb-3 flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#0E78AA] text-xs font-bold text-white">
                      {index + 1}
                    </span>
                    <div>
                      <p className="flex items-center gap-1.5 text-sm font-bold text-slate-900">
                        <Icon className="h-4 w-4 text-[#0E78AA]" aria-hidden />
                        {def?.label ?? action.type}
                      </p>
                      <p className="mt-0.5 text-xs text-slate-500">{def?.description}</p>
                    </div>
                  </div>
                  {!readOnly ? (
                    <button
                      type="button"
                      onClick={() => removeAction(index)}
                      aria-label="إزالة هذا الإجراء"
                      className="rounded-lg p-1.5 text-slate-400 hover:bg-white hover:text-rose-600"
                    >
                      <Trash2 className="h-4 w-4" aria-hidden />
                    </button>
                  ) : null}
                </div>
                {def ? (
                  <ActionConfigForm
                    action={def}
                    config={action.config ?? {}}
                    onChange={(config) => updateConfig(index, config)}
                    readOnly={readOnly}
                  />
                ) : null}
              </div>
            );
          })}
        </div>
      )}

      {!readOnly ? (
        <button
          type="button"
          onClick={() => setPickerOpen(true)}
          className="mt-1 inline-flex w-fit items-center gap-1.5 rounded-lg px-2 py-1.5 text-sm font-semibold text-[#0E78AA] hover:bg-[#F6FBFD]"
        >
          <Plus className="h-4 w-4" aria-hidden />
          إضافة إجراء
        </button>
      ) : null}

      <ActionPickerDialog
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onSelect={addAction}
        excludeTypes={actions.map((a) => a.type)}
      />
    </div>
  );
}
