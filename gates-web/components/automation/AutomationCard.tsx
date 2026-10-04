'use client';

import { useRouter } from 'next/navigation';
import { ArrowDown, Copy, MoreHorizontal, Pencil, Trash2 } from 'lucide-react';
import { Button, StatusBadge, Switch } from '@/components/ui';
import { SimpleDropdownMenu } from '@/components/inventory/SimpleDropdownMenu';
import { actionIcon, eventIcon } from '@/lib/automation/presentation';
import { categoryLabel, catalogText } from '@/lib/automation/labels';
import { findEvent } from '@/lib/automation/metadata';
import {
  describeActionLabel,
  describeCondition,
  formatRelativeTime,
  runStatusLabel,
  runStatusTone,
} from '@/lib/automation/humanize';
import type { AutomationRule, AutomationRun } from '@/lib/automation/types';
import { useAutomationMetadataQuery } from '@/lib/hooks/useAutomationRules';
import { useI18n } from '@/lib/i18n';

type Props = {
  rule: AutomationRule;
  lastRun?: AutomationRun;
  onToggle: (enabled: boolean) => void;
  togglePending?: boolean;
  onDuplicate: () => void;
  onDelete: () => void;
};

export function AutomationCard({ rule, lastRun, onToggle, togglePending, onDuplicate, onDelete }: Props) {
  const router = useRouter();
  const { t, locale } = useI18n();
  const { data } = useAutomationMetadataQuery();
  const metadata = data?.data;
  const event = findEvent(metadata, rule.eventType);
  const primaryAction = rule.actions[0];
  const TriggerIcon = event ? eventIcon(event.eventType) : null;
  const ActionIcon = actionIcon(primaryAction?.type ?? '');

  return (
    <article className="flex flex-col gap-4 rounded-2xl border border-border bg-surface-1 p-5 shadow-subtle transition hover:shadow-md">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className={`h-2 w-2 shrink-0 rounded-full ${rule.enabled ? 'bg-emerald-500' : 'bg-slate-300'}`} aria-hidden />
            <h3 className="truncate text-base font-bold text-foreground">{rule.name}</h3>
          </div>
          {rule.description ? <p className="mt-1 truncate text-xs text-foreground-muted">{rule.description}</p> : null}
          {rule.attention?.needsAttention ? (
            <p className="mt-2 rounded-lg border border-warning/40 bg-[var(--warning-soft,rgba(245,158,11,0.12))] px-2 py-1 text-xs font-semibold text-foreground">
              {t('automation.needsAttention')}
            </p>
          ) : null}
        </div>
        <Switch checked={rule.enabled} onCheckedChange={onToggle} disabled={togglePending} />
      </div>

      {event ? (
        <span className="inline-flex w-fit items-center rounded-lg bg-primary/10 px-2 py-1 text-[11px] font-semibold text-primary">
          {categoryLabel(t, event.category)}
        </span>
      ) : null}

      <div className="flex flex-col gap-2 rounded-xl bg-surface-2 p-3">
        <div className="flex items-center gap-2 text-sm text-foreground">
          {TriggerIcon ? <TriggerIcon className="h-4 w-4 shrink-0 text-primary" aria-hidden /> : null}
          <span className="font-semibold">{event ? catalogText(t, event.labelKey) : rule.eventType}</span>
        </div>
        {rule.conditions.length > 0 ? (
          <div className="ms-6 flex flex-col gap-0.5">
            {rule.conditions.slice(0, 2).map((condition, index) => (
              <p key={index} className="text-xs text-foreground-muted">
                {describeCondition(t, metadata, rule.eventType, condition)}
              </p>
            ))}
            {rule.conditions.length > 2 ? (
              <p className="text-xs text-foreground-muted">{t('automation.moreConditions', { count: rule.conditions.length - 2 })}</p>
            ) : null}
          </div>
        ) : null}

        <ArrowDown className="ms-1.5 h-3.5 w-3.5 text-foreground-muted" aria-hidden />

        <div className="flex items-center gap-2 text-sm text-foreground">
          <ActionIcon className="h-4 w-4 shrink-0 text-primary" aria-hidden />
          <span className="font-semibold">{describeActionLabel(t, metadata, primaryAction?.type)}</span>
        </div>
        {rule.actions.length > 1 ? (
          <p className="ms-6 text-xs text-foreground-muted">{t('automation.moreActions', { count: rule.actions.length - 1 })}</p>
        ) : null}
      </div>

      <div className="flex items-center justify-between gap-2 border-t border-border pt-3">
        <div className="min-w-0 text-xs text-foreground-muted">
          {lastRun ? (
            <span className="inline-flex flex-wrap items-center gap-1.5">
              {t('automation.lastRun')} {formatRelativeTime(lastRun.startedAt, locale)}
              <StatusBadge compact tone={runStatusTone(lastRun.status)} label={runStatusLabel(t, lastRun.status)} />
            </span>
          ) : (
            <span>{t('automation.neverRun')}</span>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Button variant="secondary" size="sm" onClick={() => router.push(`/automation/${rule.id}`)}>
            {t('automation.view')}
          </Button>
          <SimpleDropdownMenu
            align="left"
            trigger={
              <button
                type="button"
                aria-label={t('automation.actionsMenu')}
                title={t('automation.actionsMenu')}
                className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-foreground-muted hover:bg-surface-2 hover:text-foreground"
              >
                <MoreHorizontal className="h-5 w-5" aria-hidden />
              </button>
            }
            items={[
              {
                id: 'edit',
                label: t('automation.edit'),
                icon: <Pencil className="h-4 w-4" />,
                onClick: () => router.push(`/automation/${rule.id}/edit`),
              },
              {
                id: 'duplicate',
                label: t('automation.duplicate'),
                icon: <Copy className="h-4 w-4" />,
                onClick: onDuplicate,
              },
              {
                id: 'delete',
                label: t('automation.delete'),
                icon: <Trash2 className="h-4 w-4" />,
                destructive: true,
                onClick: onDelete,
              },
            ]}
          />
        </div>
      </div>
    </article>
  );
}
