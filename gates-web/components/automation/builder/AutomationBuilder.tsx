'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion, useReducedMotion } from 'framer-motion';
import { FormStickyFooter, Input } from '@/components/ui';
import { catalogText } from '@/lib/automation/labels';
import { describeActionLabel, describeCondition, describeTrigger } from '@/lib/automation/humanize';
import { missingRequiredConfig, validateAutomationDraft } from '@/lib/automation/validate-rule';
import type { AutomationAction, AutomationCondition } from '@/lib/automation/types';
import { useAutomationMetadataQuery } from '@/lib/hooks/useAutomationRules';
import { TriggerBlock } from './TriggerBlock';
import { ConditionGroup } from './ConditionGroup';
import { ActionBlock } from './ActionBlock';
import { FlowConnector } from './FlowConnector';
import { useI18n } from '@/lib/i18n';

export type BuilderState = {
  name: string;
  description: string;
  eventType: string | null;
  conditions: AutomationCondition[];
  actions: AutomationAction[];
};

export function emptyBuilderState(): BuilderState {
  return { name: '', description: '', eventType: null, conditions: [], actions: [] };
}

type SavePayload = {
  name: string;
  description?: string;
  eventType: string;
  enabled: boolean;
  conditions: AutomationCondition[];
  actions: AutomationAction[];
};

type Props = {
  initial: BuilderState;
  isEditing?: boolean;
  initialEnabled?: boolean;
  onSave: (payload: SavePayload) => Promise<unknown>;
  saving?: boolean;
};

function isSupplierField(labelKey: string): boolean {
  return labelKey === 'automation.fields.supplier' || labelKey.endsWith('.supplier');
}

export function AutomationBuilder({ initial, isEditing, initialEnabled, onSave, saving }: Props) {
  const router = useRouter();
  const { t } = useI18n();
  const reduce = useReducedMotion();
  const { data, isLoading, isError } = useAutomationMetadataQuery();
  const metadata = data?.data;
  const [state, setState] = useState<BuilderState>(initial);
  const [error, setError] = useState<string | null>(null);
  const snapshotRef = useRef(JSON.stringify(initial));
  const [dirty, setDirty] = useState(false);

  const seededRef = useRef(false);
  useEffect(() => {
    if (seededRef.current) return;
    if (!initial.eventType && initial.actions.length === 0 && !initial.name) return;
    setState(initial);
    snapshotRef.current = JSON.stringify(initial);
    seededRef.current = true;
  }, [initial]);

  useEffect(() => {
    setDirty(JSON.stringify(state) !== snapshotRef.current);
  }, [state]);

  const patch = (next: Partial<BuilderState>) => setState((prev) => ({ ...prev, ...next }));

  const missing = missingRequiredConfig(metadata, state.eventType, state.actions);
  const supplierMissing = missing.some(isSupplierField);
  const otherMissing = missing.filter((key) => !isSupplierField(key));

  const save = async (enabled: boolean) => {
    if (supplierMissing) {
      setError(t('automation.chooseSupplier'));
      return;
    }
    const validationError = validateAutomationDraft(t, metadata, state);
    if (validationError) {
      setError(validationError);
      return;
    }
    setError(null);
    try {
      await onSave({
        name: state.name.trim(),
        description: state.description.trim() || undefined,
        eventType: state.eventType as string,
        enabled,
        conditions: state.conditions,
        actions: state.actions,
      });
      snapshotRef.current = JSON.stringify(state);
      setDirty(false);
    } catch {
      // useApiMutation already surfaces the error toast.
    }
  };

  return (
    <div className="flex flex-col gap-6 pb-28">
      <div className="rounded-2xl border border-border bg-surface-1 p-5 shadow-subtle">
        <label className="mb-1.5 block text-xs font-semibold text-foreground-muted">{t('automation.name')}</label>
        <Input
          value={state.name}
          onChange={(e) => patch({ name: e.target.value })}
          placeholder={t('automation.namePlaceholder')}
          className="h-11 text-base font-semibold"
        />
        <label className="mb-1.5 mt-3 block text-xs font-semibold text-foreground-muted">{t('automation.description')}</label>
        <Input
          value={state.description}
          onChange={(e) => patch({ description: e.target.value })}
          placeholder={t('automation.descriptionPlaceholder')}
        />
      </div>

      <div className="overflow-hidden rounded-[28px] border border-primary/15 bg-gradient-to-b from-primary/10 to-surface-1 p-4 shadow-subtle sm:p-6">
        <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-primary">{t('automation.liveRule')}</p>
        <p className="mt-2 text-lg font-semibold text-foreground">
          {state.name.trim() || t('automation.namePlaceholder')}
        </p>
        <div className="mt-3 grid gap-2 text-sm sm:grid-cols-3">
          <p className="rounded-xl bg-surface-1 px-3 py-2">
            <span className="block text-[11px] font-bold text-foreground-muted">{t('automation.whenLabel')}</span>
            {describeTrigger(t, metadata, state.eventType) || t('automation.whenPrompt')}
          </p>
          <p className="rounded-xl bg-surface-1 px-3 py-2">
            <span className="block text-[11px] font-bold text-foreground-muted">{t('automation.ifLabel')}</span>
            {state.conditions[0]
              ? describeCondition(t, metadata, state.eventType ?? '', state.conditions[0])
              : t('automation.everyTime')}
          </p>
          <p className="rounded-xl bg-surface-1 px-3 py-2">
            <span className="block text-[11px] font-bold text-foreground-muted">{t('automation.thenLabel')}</span>
            {describeActionLabel(t, metadata, state.actions[0]?.type) || t('automation.thenPrompt')}
          </p>
        </div>
      </div>

      <div className="rounded-[28px] border border-border bg-surface-1 p-5 shadow-subtle">
        {isLoading ? <p className="text-sm text-foreground-muted">{t('automation.loading')}</p> : null}
        {isError ? <p className="mb-3 text-sm text-danger">{t('automation.metadataError')}</p> : null}
        <motion.div initial={reduce ? false : { opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
        <TriggerBlock
          eventType={state.eventType}
          onChange={(eventType) =>
            setState((prev) => ({
              ...prev,
              eventType,
              conditions: prev.eventType === eventType ? prev.conditions : [],
            }))
          }
        />
        <FlowConnector />
        <ConditionGroup eventType={state.eventType} conditions={state.conditions} onChange={(conditions) => patch({ conditions })} />
        <FlowConnector />
        <ActionBlock eventType={state.eventType} actions={state.actions} onChange={(actions) => patch({ actions })} />
        </motion.div>
      </div>

      {supplierMissing ? (
        <p className="rounded-xl border border-primary/30 bg-primary/5 px-4 py-2.5 text-sm font-medium text-foreground">
          {t('automation.chooseSupplier')}
        </p>
      ) : null}
      {otherMissing.map((key) => (
        <p key={key} className="rounded-xl border border-primary/30 bg-primary/5 px-4 py-2.5 text-sm font-medium text-foreground">
          {t('automation.completeRequired', { field: catalogText(t, key) })}
        </p>
      ))}
      {error ? (
        <p className="rounded-xl border border-danger/20 bg-[var(--danger-soft)] px-4 py-2.5 text-sm font-medium text-danger">
          {error}
        </p>
      ) : null}

      <FormStickyFooter
        onCancel={() => router.push('/automation')}
        onSaveDraft={() => save(false)}
        onSave={() => save(true)}
        draftText={t('automation.saveDraft')}
        saveText={initialEnabled ? t('automation.save') : t('automation.saveActivate')}
        saveLoading={saving}
        draftLoading={saving}
        respectPermissions
        status={dirty ? t('status.unsaved') : isEditing ? t('status.saved') : undefined}
      />
    </div>
  );
}
