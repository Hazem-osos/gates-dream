'use client';

import { Plus, Trash2 } from 'lucide-react';
import { Input } from '@/components/ui';
import { findTrigger, OPERATORS_BY_FIELD_TYPE, OPERATOR_LABELS } from '@/lib/automation/catalog';
import type { AutomationCondition } from '@/lib/automation/types';

type Props = {
  eventType: string | null;
  conditions: AutomationCondition[];
  onChange: (conditions: AutomationCondition[]) => void;
  readOnly?: boolean;
};

const selectCls =
  'h-9 rounded-lg border border-[#D6EAF3] bg-white px-2 text-sm text-[#094C6B] focus:border-[#0E78AA] focus:outline-none focus:ring-2 focus:ring-[#0E78AA]/15';

export function ConditionGroup({ eventType, conditions, onChange, readOnly }: Props) {
  const trigger = findTrigger(eventType ?? undefined);

  if (!trigger) {
    return (
      <div className="flex flex-col gap-2 opacity-50">
        <span className="text-xs font-bold uppercase tracking-wide text-slate-400">فقط إذا (IF) — اختياري</span>
        <p className="rounded-xl border border-dashed border-slate-200 bg-white p-3 text-xs text-slate-400">
          اختر أولًا ما يبدأ الأتمتة (WHEN)
        </p>
      </div>
    );
  }

  const addCondition = () => {
    const field = trigger.fields[0];
    if (!field) return;
    onChange([...conditions, { field: field.field, operator: OPERATORS_BY_FIELD_TYPE[field.type][0], value: '' }]);
  };

  const updateCondition = (index: number, patch: Partial<AutomationCondition>) => {
    onChange(conditions.map((c, i) => (i === index ? { ...c, ...patch } : c)));
  };

  const removeCondition = (index: number) => {
    onChange(conditions.filter((_, i) => i !== index));
  };

  return (
    <div className="flex flex-col gap-2">
      <span className="text-xs font-bold uppercase tracking-wide text-slate-400">فقط إذا (IF) — اختياري</span>

      {conditions.length === 0 ? (
        <p className="rounded-xl border border-dashed border-slate-200 bg-white p-3 text-xs text-slate-500">
          بدون شروط، ستُنفَّذ الأتمتة كل مرة يحدث فيها المُشغِّل.
        </p>
      ) : (
        <div className="flex flex-col gap-2">
          {conditions.map((condition, index) => {
            const field = trigger.fields.find((f) => f.field === condition.field) ?? trigger.fields[0];
            const operators = OPERATORS_BY_FIELD_TYPE[field?.type ?? 'number'];
            return (
              <div key={index} className="flex flex-col gap-2">
                {index > 0 ? (
                  <span className="mr-1 text-[11px] font-bold text-slate-400">AND</span>
                ) : null}
                <div className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-200/80 bg-white p-2.5">
                  <select
                    className={selectCls}
                    value={condition.field}
                    disabled={readOnly}
                    onChange={(e) => updateCondition(index, { field: e.target.value })}
                  >
                    {trigger.fields.map((f) => (
                      <option key={f.field} value={f.field}>
                        {f.label}
                      </option>
                    ))}
                  </select>
                  <select
                    className={selectCls}
                    value={condition.operator}
                    disabled={readOnly}
                    onChange={(e) => updateCondition(index, { operator: e.target.value as AutomationCondition['operator'] })}
                  >
                    {operators.map((op) => (
                      <option key={op} value={op}>
                        {OPERATOR_LABELS[op]}
                      </option>
                    ))}
                  </select>
                  <Input
                    className="h-9 w-32"
                    type={field?.type === 'number' ? 'number' : 'text'}
                    value={String(condition.value ?? '')}
                    disabled={readOnly}
                    onChange={(e) =>
                      updateCondition(index, {
                        value: field?.type === 'number' ? Number(e.target.value) : e.target.value,
                      })
                    }
                  />
                  {!readOnly ? (
                    <button
                      type="button"
                      onClick={() => removeCondition(index)}
                      aria-label="إزالة الشرط"
                      className="mr-auto rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-rose-600"
                    >
                      <Trash2 className="h-4 w-4" aria-hidden />
                    </button>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {!readOnly ? (
        <button
          type="button"
          onClick={addCondition}
          className="mt-1 inline-flex w-fit items-center gap-1.5 rounded-lg px-2 py-1.5 text-sm font-semibold text-[#0E78AA] hover:bg-[#F6FBFD]"
        >
          <Plus className="h-4 w-4" aria-hidden />
          إضافة شرط
        </button>
      ) : null}
    </div>
  );
}
