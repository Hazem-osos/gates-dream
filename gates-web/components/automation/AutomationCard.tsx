'use client';

import { useRouter } from 'next/navigation';
import { ArrowDown, Copy, MoreHorizontal, Pencil, Trash2 } from 'lucide-react';
import { Button, StatusBadge, Switch } from '@/components/ui';
import { SimpleDropdownMenu } from '@/components/inventory/SimpleDropdownMenu';
import { findAction, findTrigger } from '@/lib/automation/catalog';
import {
  describeActionSummary,
  describeCondition,
  formatRelativeTimeAr,
  RUN_STATUS_LABEL,
  runStatusTone,
} from '@/lib/automation/humanize';
import type { AutomationRule, AutomationRun } from '@/lib/automation/types';

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
  const trigger = findTrigger(rule.eventType);
  const primaryAction = rule.actions[0];
  const action = findAction(primaryAction?.type);
  const TriggerIcon = trigger?.icon;
  const ActionIcon = action?.icon;

  return (
    <article
      className="flex flex-col gap-4 rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm transition hover:shadow-md dark:border-slate-800 dark:bg-slate-900"
      dir="rtl"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span
              className={`h-2 w-2 shrink-0 rounded-full ${rule.enabled ? 'bg-emerald-500' : 'bg-slate-300'}`}
              aria-hidden
            />
            <h3 className="truncate text-base font-bold text-slate-900 dark:text-white">{rule.name}</h3>
          </div>
          {rule.description ? (
            <p className="mt-1 truncate text-xs text-slate-500">{rule.description}</p>
          ) : null}
        </div>
        <Switch checked={rule.enabled} onCheckedChange={onToggle} disabled={togglePending} />
      </div>

      {trigger?.moduleLabel ? (
        <span className="inline-flex w-fit items-center rounded-lg bg-[#0E78AA0D] px-2 py-1 text-[11px] font-semibold text-[#0E78AA]">
          {trigger.moduleLabel}
        </span>
      ) : null}

      <div className="flex flex-col gap-2 rounded-xl bg-[#F6FBFD] p-3">
        <div className="flex items-center gap-2 text-sm text-slate-700">
          {TriggerIcon ? <TriggerIcon className="h-4 w-4 shrink-0 text-[#0E78AA]" aria-hidden /> : null}
          <span className="font-semibold text-slate-800">{trigger?.label ?? rule.eventType}</span>
        </div>
        {rule.conditions.length > 0 ? (
          <div className="mr-6 flex flex-col gap-0.5">
            {rule.conditions.slice(0, 2).map((c, i) => (
              <p key={i} className="text-xs text-slate-500">
                {describeCondition(c, rule.eventType)}
              </p>
            ))}
            {rule.conditions.length > 2 ? (
              <p className="text-xs text-slate-400">+{rule.conditions.length - 2} شروط أخرى</p>
            ) : null}
          </div>
        ) : null}

        <ArrowDown className="mr-[0.4rem] h-3.5 w-3.5 text-slate-300" aria-hidden />

        <div className="flex items-center gap-2 text-sm text-slate-700">
          {ActionIcon ? <ActionIcon className="h-4 w-4 shrink-0 text-[#0E78AA]" aria-hidden /> : null}
          <span className="font-semibold text-slate-800">
            {describeActionSummary(primaryAction?.type ?? '', primaryAction?.config)}
          </span>
        </div>
        {rule.actions.length > 1 ? (
          <p className="mr-6 text-xs text-slate-400">+{rule.actions.length - 1} إجراءات أخرى</p>
        ) : null}
      </div>

      <div className="flex items-center justify-between gap-2 border-t border-slate-100 pt-3 dark:border-slate-800">
        <div className="min-w-0 text-xs text-slate-500">
          {lastRun ? (
            <span className="inline-flex items-center gap-1.5">
              آخر تشغيل: {formatRelativeTimeAr(lastRun.startedAt)}
              <StatusBadge
                compact
                tone={runStatusTone(lastRun.status)}
                label={RUN_STATUS_LABEL[lastRun.status]}
              />
            </span>
          ) : (
            <span>لم تُشغَّل بعد</span>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Button variant="secondary" size="sm" onClick={() => router.push(`/automation/${rule.id}`)}>
            عرض
          </Button>
          <SimpleDropdownMenu
            align="left"
            trigger={
              <button
                type="button"
                aria-label="قائمة الإجراءات"
                title="قائمة الإجراءات"
                className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700"
              >
                <MoreHorizontal className="h-5 w-5" aria-hidden />
              </button>
            }
            items={[
              {
                id: 'edit',
                label: 'تعديل',
                icon: <Pencil className="h-4 w-4" />,
                onClick: () => router.push(`/automation/${rule.id}/edit`),
              },
              {
                id: 'duplicate',
                label: 'نسخ',
                icon: <Copy className="h-4 w-4" />,
                onClick: onDuplicate,
              },
              {
                id: 'delete',
                label: 'حذف',
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
