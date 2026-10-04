'use client';

import { useState } from 'react';
import { Pencil, Zap } from 'lucide-react';
import { eventIcon } from '@/lib/automation/presentation';
import { catalogText } from '@/lib/automation/labels';
import { findEvent } from '@/lib/automation/metadata';
import { useAutomationMetadataQuery } from '@/lib/hooks/useAutomationRules';
import { TriggerPickerDialog } from './TriggerPickerDialog';
import { useI18n } from '@/lib/i18n';

type Props = {
  eventType: string | null;
  onChange: (eventType: string) => void;
  readOnly?: boolean;
};

export function TriggerBlock({ eventType, onChange, readOnly }: Props) {
  const { t } = useI18n();
  const [pickerOpen, setPickerOpen] = useState(false);
  const { data } = useAutomationMetadataQuery();
  const event = findEvent(data?.data, eventType);
  const Icon = event ? eventIcon(event.eventType) : Zap;

  return (
    <div className="flex flex-col gap-2">
      <div>
        <span className="text-xs font-bold uppercase tracking-wide text-foreground-muted">{t('automation.whenLabel')}</span>
        <p className="text-xs text-foreground-muted">{t('automation.whenPrompt')}</p>
      </div>
      {event ? (
        <div className="flex items-start justify-between gap-3 rounded-2xl border-2 border-primary/25 bg-surface-2 p-4">
          <div className="flex items-start gap-3">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground">
              <Icon className="h-5 w-5" aria-hidden />
            </span>
            <div>
              <p className="text-sm font-bold text-foreground">{catalogText(t, event.labelKey)}</p>
              <p className="mt-0.5 text-xs text-foreground-muted">{catalogText(t, event.descriptionKey)}</p>
              {event.emission === 'scheduled' ? (
                <p className="mt-1 text-[11px] font-medium text-primary">{t('automation.scheduledHint')}</p>
              ) : null}
            </div>
          </div>
          {!readOnly ? (
            <button
              type="button"
              onClick={() => setPickerOpen(true)}
              className="inline-flex shrink-0 items-center gap-1 rounded-lg px-2 py-1 text-xs font-semibold text-primary hover:bg-surface-1"
            >
              <Pencil className="h-3.5 w-3.5" aria-hidden />
              {t('automation.change')}
            </button>
          ) : null}
        </div>
      ) : (
        <button
          type="button"
          disabled={readOnly}
          onClick={() => setPickerOpen(true)}
          className="flex items-center gap-3 rounded-2xl border-2 border-dashed border-border bg-surface-1 p-4 text-start transition hover:border-primary hover:bg-surface-2 disabled:cursor-not-allowed disabled:opacity-60"
        >
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-surface-2 text-foreground-muted">
            <Zap className="h-5 w-5" aria-hidden />
          </span>
          <span className="text-sm font-semibold text-foreground-muted">{t('automation.pickTrigger')}</span>
        </button>
      )}

      {!readOnly ? (
        <TriggerPickerDialog
          open={pickerOpen}
          onClose={() => setPickerOpen(false)}
          onSelect={(next) => onChange(next.eventType)}
        />
      ) : null}
    </div>
  );
}
