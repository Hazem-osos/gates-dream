'use client';

import { TriggerBlock } from './builder/TriggerBlock';
import { ConditionGroup } from './builder/ConditionGroup';
import { ActionBlock } from './builder/ActionBlock';
import { FlowConnector } from './builder/FlowConnector';
import type { AutomationRule } from '@/lib/automation/types';

export function AutomationDetailsView({ rule }: { rule: AutomationRule }) {
  return (
    <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <TriggerBlock eventType={rule.eventType} onChange={() => {}} readOnly />
      <FlowConnector />
      <ConditionGroup eventType={rule.eventType} conditions={rule.conditions} onChange={() => {}} readOnly />
      <FlowConnector />
      <ActionBlock actions={rule.actions} onChange={() => {}} readOnly />
    </div>
  );
}
