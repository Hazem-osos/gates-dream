'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { FormStickyFooter, Input } from '@/components/ui';
import type { AutomationTriggerDef } from '@/lib/automation/catalog';
import type { AutomationAction, AutomationCondition } from '@/lib/automation/types';
import { TriggerBlock } from './TriggerBlock';
import { ConditionGroup } from './ConditionGroup';
import { ActionBlock } from './ActionBlock';
import { FlowConnector } from './FlowConnector';

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
  /** Present in edit mode — used only to know whether "الحفظ" changes an existing rule. */
  isEditing?: boolean;
  initialEnabled?: boolean;
  onSave: (payload: SavePayload) => Promise<unknown>;
  saving?: boolean;
};

export function AutomationBuilder({ initial, isEditing, initialEnabled, onSave, saving }: Props) {
  const router = useRouter();
  const [state, setState] = useState<BuilderState>(initial);
  const [error, setError] = useState<string | null>(null);
  const snapshotRef = useRef(JSON.stringify(initial));
  const [dirty, setDirty] = useState(false);

  // Re-seed once if `initial` changes identity after data finishes loading (edit mode).
  const seededRef = useRef(false);
  useEffect(() => {
    if (seededRef.current) return;
    if (!initial.eventType && initial.actions.length === 0 && !initial.name) return;
    setState(initial);
    snapshotRef.current = JSON.stringify(initial);
    seededRef.current = true;
    // eslint-disable-next-line react-hooks/exhaustive-deps -- seed exactly once when real data arrives
  }, [initial]);

  useEffect(() => {
    setDirty(JSON.stringify(state) !== snapshotRef.current);
  }, [state]);

  const patch = (next: Partial<BuilderState>) => setState((prev) => ({ ...prev, ...next }));

  const handleTriggerChange = (trigger: AutomationTriggerDef) => {
    setState((prev) => ({
      ...prev,
      eventType: trigger.eventType,
      // Conditions reference field paths specific to the previous trigger — reset if it changed.
      conditions: prev.eventType === trigger.eventType ? prev.conditions : [],
    }));
  };

  const validate = (): string | null => {
    if (!state.name.trim()) return 'اكتب اسمًا لهذه الأتمتة';
    if (!state.eventType) return 'اختر ما يبدأ هذه الأتمتة (WHEN)';
    if (state.actions.length === 0) return 'اختر إجراءً واحدًا على الأقل (THEN)';
    return null;
  };

  const save = async (enabled: boolean) => {
    const validationError = validate();
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
      // useApiMutation already surfaces the error toast; nothing else to do here.
    }
  };

  return (
    <div className="flex flex-col gap-6 pb-28">
      <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <label className="mb-1.5 block text-xs font-semibold text-slate-600">اسم الأتمتة</label>
        <Input
          value={state.name}
          onChange={(e) => patch({ name: e.target.value })}
          placeholder="مثال: تعويض المخزون المنخفض"
          className="h-11 text-base font-semibold"
        />
        <label className="mb-1.5 mt-3 block text-xs font-semibold text-slate-600">وصف (اختياري)</label>
        <Input
          value={state.description}
          onChange={(e) => patch({ description: e.target.value })}
          placeholder="وصف مختصر يساعدك على تذكر الغرض من هذه الأتمتة"
        />
      </div>

      <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <TriggerBlock eventType={state.eventType} onChange={handleTriggerChange} />

        <FlowConnector />

        <ConditionGroup
          eventType={state.eventType}
          conditions={state.conditions}
          onChange={(conditions) => patch({ conditions })}
        />

        <FlowConnector />

        <ActionBlock actions={state.actions} onChange={(actions) => patch({ actions })} />
      </div>

      {error ? (
        <p className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-2.5 text-sm font-medium text-rose-700">
          {error}
        </p>
      ) : null}

      <FormStickyFooter
        onCancel={() => router.push('/automation')}
        onSaveDraft={() => save(false)}
        onSave={() => save(true)}
        draftText="حفظ كمسودة"
        saveText={initialEnabled ? 'حفظ' : 'حفظ وتفعيل'}
        saveLoading={saving}
        draftLoading={saving}
        respectPermissions
        status={dirty ? 'تغييرات غير محفوظة' : isEditing ? 'محفوظ' : undefined}
      />
    </div>
  );
}
