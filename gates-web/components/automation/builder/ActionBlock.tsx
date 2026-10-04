'use client';

import { useState } from 'react';
import { ChevronDown, ChevronUp, Plus, Trash2, Zap } from 'lucide-react';
import { actionIcon } from '@/lib/automation/presentation';
import { catalogText } from '@/lib/automation/labels';
import { findActionDef, type AutomationActionDef } from '@/lib/automation/metadata';
import type { AutomationAction } from '@/lib/automation/types';
import { useAutomationMetadataQuery } from '@/lib/hooks/useAutomationRules';
import { ActionConfigForm } from './ActionConfigForm';
import { ActionPickerDialog } from './ActionPickerDialog';
import { useI18n } from '@/lib/i18n';

type Props = {
  eventType: string | null;
  actions: AutomationAction[];
  onChange: (actions: AutomationAction[]) => void;
  readOnly?: boolean;
};

function defaultConfig(def: AutomationActionDef): Record<string, unknown> {
  const config: Record<string, unknown> = {};
  for (const field of def.config) {
    if (field.default !== undefined) config[field.key] = field.default;
  }
  return config;
}

export function ActionBlock({ eventType, actions, onChange, readOnly }: Props) {
  const { t } = useI18n();
  const [pickerOpen, setPickerOpen] = useState(false);
  const { data } = useAutomationMetadataQuery();
  const metadata = data?.data;

  const addAction = (def: AutomationActionDef) => {
    onChange([...actions, { type: def.type, config: defaultConfig(def) }]);
  };

  const move = (index: number, direction: -1 | 1) => {
    const next = index + direction;
    if (next < 0 || next >= actions.length) return;
    const copy = [...actions];
    const [item] = copy.splice(index, 1);
    copy.splice(next, 0, item!);
    onChange(copy);
  };

  return (
    <div className="flex flex-col gap-2">
      <div>
        <span className="text-xs font-bold uppercase tracking-wide text-foreground-muted">{t('automation.thenLabel')}</span>
        <p className="text-xs text-foreground-muted">{t('automation.thenPrompt')}</p>
      </div>

      {actions.length === 0 ? (
        <button
          type="button"
          disabled={readOnly}
          onClick={() => setPickerOpen(true)}
          className="flex items-center gap-3 rounded-2xl border-2 border-dashed border-border bg-surface-1 p-4 text-start transition hover:border-primary hover:bg-surface-2 disabled:cursor-not-allowed disabled:opacity-60"
        >
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-surface-2 text-foreground-muted">
            <Zap className="h-5 w-5" aria-hidden />
          </span>
          <span className="text-sm font-semibold text-foreground-muted">{t('automation.pickAction')}</span>
        </button>
      ) : (
        <div className="relative flex flex-col gap-3 ps-1">
          {actions.map((action, index) => {
            const def = findActionDef(metadata, action.type);
            const Icon = actionIcon(action.type);
            const last = index === actions.length - 1;
            return (
              <div key={`${action.type}-${index}`} className="flex gap-3">
                <div className="flex w-8 shrink-0 flex-col items-center">
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
                    {index + 1}
                  </span>
                  {!last ? <span className="mt-1 w-px flex-1 bg-primary/25" aria-hidden /> : null}
                </div>
                <div className="min-w-0 flex-1 rounded-2xl border-2 border-primary/25 bg-surface-2 p-4">
                  <div className="mb-3 flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="flex items-center gap-1.5 text-sm font-bold text-foreground">
                        <Icon className="h-4 w-4 shrink-0 text-primary" aria-hidden />
                        {def ? catalogText(t, def.labelKey) : action.type}
                      </p>
                      {def ? <p className="mt-0.5 text-xs text-foreground-muted">{catalogText(t, def.descriptionKey)}</p> : null}
                    </div>
                    {!readOnly ? (
                      <div className="flex shrink-0 items-center gap-1">
                        <button
                          type="button"
                          aria-label={t('automation.moveUp')}
                          disabled={index === 0}
                          onClick={() => move(index, -1)}
                          className="rounded-lg p-1.5 text-foreground-muted hover:bg-surface-1 disabled:opacity-30"
                        >
                          <ChevronUp className="h-4 w-4" aria-hidden />
                        </button>
                        <button
                          type="button"
                          aria-label={t('automation.moveDown')}
                          disabled={last}
                          onClick={() => move(index, 1)}
                          className="rounded-lg p-1.5 text-foreground-muted hover:bg-surface-1 disabled:opacity-30"
                        >
                          <ChevronDown className="h-4 w-4" aria-hidden />
                        </button>
                        <button
                          type="button"
                          onClick={() => onChange(actions.filter((_, i) => i !== index))}
                          aria-label={t('automation.removeAction')}
                          className="rounded-lg p-1.5 text-foreground-muted hover:bg-surface-1 hover:text-danger"
                        >
                          <Trash2 className="h-4 w-4" aria-hidden />
                        </button>
                      </div>
                    ) : null}
                  </div>
                  {def ? (
                    <ActionConfigForm
                      action={def}
                      instanceId={`${index}-${action.type}`}
                      eventType={eventType}
                      config={action.config ?? {}}
                      onChange={(config) => onChange(actions.map((row, i) => (i === index ? { ...row, config } : row)))}
                      readOnly={readOnly}
                    />
                  ) : (
                    <p className="text-xs text-danger">{t('automation.actionUnsupported')}</p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {!readOnly ? (
        <button
          type="button"
          onClick={() => setPickerOpen(true)}
          className="mt-1 inline-flex w-fit items-center gap-1.5 rounded-lg px-2 py-1.5 text-sm font-semibold text-primary hover:bg-surface-2"
        >
          <Plus className="h-4 w-4" aria-hidden />
          {t('automation.addAction')}
        </button>
      ) : null}

      {!readOnly ? (
        <ActionPickerDialog open={pickerOpen} onClose={() => setPickerOpen(false)} onSelect={addAction} />
      ) : null}
    </div>
  );
}
