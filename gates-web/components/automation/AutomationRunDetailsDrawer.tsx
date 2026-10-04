'use client';

import { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { MasterEntitySideDrawer } from '@/components/masters/MasterEntitySideDrawer';
import { StatusBadge } from '@/components/ui';
import {
  describeActionLabel,
  describeTrigger,
  formatDuration,
  friendlyRunError,
  runStatusLabel,
  runStatusTone,
  safeResultEntries,
} from '@/lib/automation/humanize';
import { findActionDef, recordsActionResult } from '@/lib/automation/metadata';
import type { AutomationRun } from '@/lib/automation/types';
import { useAutomationMetadataQuery } from '@/lib/hooks/useAutomationRules';
import { useI18n } from '@/lib/i18n';

type Props = {
  run: AutomationRun | null;
  onClose: () => void;
};

function resultKeyLabel(t: (key: string) => string, key: string): string {
  const translated = t(`automation.resultKeys.${key}`);
  return translated === `automation.resultKeys.${key}` ? key : translated;
}

export function AutomationRunDetailsDrawer({ run, onClose }: Props) {
  const { t, locale } = useI18n();
  const [showTechnical, setShowTechnical] = useState(false);
  const { data } = useAutomationMetadataQuery();
  const metadata = data?.data;
  if (!run) return null;

  const action = findActionDef(metadata, run.actionType);
  const duration = formatDuration(t, run.startedAt, run.completedAt);
  const results = safeResultEntries(run.resultMetadata);
  const recorded = recordsActionResult(action);
  const localeTag = locale === 'ar' ? 'ar-EG' : 'en-GB';

  return (
    <MasterEntitySideDrawer open={Boolean(run)} onClose={onClose} title={t('automation.runDetails')} subtitle={run.ruleName ?? undefined}>
      <div className="mb-5 flex items-center justify-between gap-3">
        <StatusBadge tone={runStatusTone(run.status)} label={runStatusLabel(t, run.status)} />
        {run.attemptCount > 0 ? (
          <span className="text-xs text-foreground-muted">{t('automation.attempt', { count: run.attemptCount })}</span>
        ) : null}
      </div>

      <dl className="flex flex-col gap-3 rounded-xl border border-border bg-surface-2 p-4 text-sm">
        <div>
          <dt className="text-xs font-semibold text-foreground-muted">{t('automation.whenLabel')}</dt>
          <dd className="font-medium text-foreground">{describeTrigger(t, metadata, run.eventType)}</dd>
        </div>
        <div>
          <dt className="text-xs font-semibold text-foreground-muted">{t('automation.thenLabel')}</dt>
          <dd className="font-medium text-foreground">{describeActionLabel(t, metadata, run.actionType)}</dd>
        </div>
        <div>
          <dt className="text-xs font-semibold text-foreground-muted">{t('automation.started')}</dt>
          <dd dir="ltr" className="text-start font-medium text-foreground">
            {new Date(run.startedAt).toLocaleString(localeTag)}
          </dd>
        </div>
        {run.completedAt ? (
          <div>
            <dt className="text-xs font-semibold text-foreground-muted">{t('automation.completed')}</dt>
            <dd dir="ltr" className="text-start font-medium text-foreground">
              {new Date(run.completedAt).toLocaleString(localeTag)}
            </dd>
          </div>
        ) : null}
        {duration ? (
          <div>
            <dt className="text-xs font-semibold text-foreground-muted">{t('automation.duration')}</dt>
            <dd className="font-medium text-foreground">{duration}</dd>
          </div>
        ) : null}
      </dl>

      {run.status === 'FAILED' ? (
        <div className="mt-4 rounded-xl border border-danger/20 bg-[var(--danger-soft)] p-4">
          <p className="text-sm font-semibold text-danger">{friendlyRunError(t, run)}</p>
        </div>
      ) : null}

      {run.status === 'PENDING' ? (
        <p className="mt-4 rounded-xl border border-warning/30 bg-surface-2 p-4 text-sm text-foreground">{t('automation.pendingNow')}</p>
      ) : null}

      {!recorded ? <p className="mt-4 text-xs text-foreground-muted">{t('automation.webhookNoHistory')}</p> : null}

      {run.resultEntityType || run.resultEntityId ? (
        <p className="mt-4 text-sm text-foreground">
          <span className="font-semibold">{t('automation.resultEntity')}: </span>
          <span dir="ltr">{[run.resultEntityType, run.resultEntityId].filter(Boolean).join(' · ')}</span>
        </p>
      ) : null}

      {results.length > 0 ? (
        <ul className="mt-3 flex flex-col gap-1 text-sm">
          {results.map(([key, value]) => (
            <li key={key}>
              <span className="text-foreground-muted">{resultKeyLabel(t, key)}: </span>
              <span dir="ltr" className="font-semibold text-foreground">
                {value}
              </span>
            </li>
          ))}
        </ul>
      ) : null}

      <div className="mt-5 border-t border-border pt-3">
        <button
          type="button"
          onClick={() => setShowTechnical((value) => !value)}
          className="inline-flex items-center gap-1 text-xs font-semibold text-foreground-muted hover:text-foreground"
        >
          <ChevronDown className={`h-3.5 w-3.5 transition-transform ${showTechnical ? 'rotate-180' : ''}`} aria-hidden />
          {t('automation.technical')}
        </button>
        {showTechnical ? (
          <dl className="mt-2 flex flex-col gap-1 rounded-lg bg-surface-2 p-3 text-[11px] text-foreground-muted" dir="ltr">
            <div>eventId: {run.eventId}</div>
            <div>correlationId: {run.correlationId}</div>
            <div>eventType: {run.eventType ?? '—'}</div>
            <div>actionType: {run.actionType}</div>
            {run.lastErrorCode ? <div>lastErrorCode: {run.lastErrorCode}</div> : null}
            {run.errorMessage ? <div className="break-words">errorMessage: {run.errorMessage}</div> : null}
          </dl>
        ) : null}
      </div>
    </MasterEntitySideDrawer>
  );
}
