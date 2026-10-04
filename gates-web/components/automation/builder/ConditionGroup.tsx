'use client';

import { Plus, Trash2 } from 'lucide-react';
import { Input } from '@/components/ui';
import { catalogText, enumLabel, operatorLabel } from '@/lib/automation/labels';
import { fieldEntityKind, findEvent, type AutomationEventField } from '@/lib/automation/metadata';
import type { AutomationCondition, AutomationConditionOperator } from '@/lib/automation/types';
import { useAutomationMetadataQuery } from '@/lib/hooks/useAutomationRules';
import { useI18n } from '@/lib/i18n';
import { AutomationEntitySelect } from './AutomationEntitySelect';

type Props = {
  eventType: string | null;
  conditions: AutomationCondition[];
  onChange: (conditions: AutomationCondition[]) => void;
  readOnly?: boolean;
};

const selectCls =
  'h-9 rounded-lg border border-border bg-surface-1 px-2 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/15';

function blankValue(field: AutomationEventField, operator: string): unknown {
  if (operator === 'in') return [];
  if (field.type === 'boolean') return false;
  if (field.type === 'number' || field.type === 'money') return '';
  return '';
}

function ConditionValue({
  field,
  condition,
  readOnly,
  onChange,
  listPath,
  listQuery,
}: {
  field: AutomationEventField;
  condition: AutomationCondition;
  readOnly?: boolean;
  onChange: (value: unknown) => void;
  listPath?: string;
  listQuery?: Record<string, string>;
}) {
  const { t } = useI18n();
  const kind = fieldEntityKind(field);

  if (condition.operator === 'in' && field.type === 'enum') {
    const selected = new Set(Array.isArray(condition.value) ? condition.value.map(String) : []);
    return (
      <div className="flex flex-wrap gap-2">
        {(field.enumValues ?? []).map((option) => (
          <label key={option} className="inline-flex items-center gap-1.5 text-xs font-medium text-foreground">
            <input
              type="checkbox"
              checked={selected.has(option)}
              disabled={readOnly}
              onChange={(e) => {
                const next = new Set(selected);
                if (e.target.checked) next.add(option);
                else next.delete(option);
                onChange([...next]);
              }}
            />
            {enumLabel(t, option)}
          </label>
        ))}
      </div>
    );
  }

  if (condition.operator === 'in' && field.type === 'entity' && kind) {
    const ids = Array.isArray(condition.value) ? condition.value.map(String) : [];
    return (
      <div className="flex min-w-[14rem] flex-1 flex-col gap-2">
        {ids.length > 0 ? (
          <div className="flex flex-col gap-1.5">
            {ids.map((id) => (
              <div key={id} className="flex items-center gap-2">
                <div className="min-w-0 flex-1">
                  <AutomationEntitySelect kind={kind} listPath={listPath} listQuery={listQuery} value={id} onChange={() => {}} disabled />
                </div>
                {!readOnly ? (
                  <button type="button" aria-label={t('automation.clear')} onClick={() => onChange(ids.filter((item) => item !== id))}>
                    ×
                  </button>
                ) : null}
              </div>
            ))}
          </div>
        ) : null}
        {!readOnly ? (
          <AutomationEntitySelect
            kind={kind}
            listPath={listPath}
            listQuery={listQuery}
            value=""
            onChange={(id) => {
              if (id && !ids.includes(id)) onChange([...ids, id]);
            }}
          />
        ) : null}
      </div>
    );
  }

  if (field.type === 'entity' && kind) {
    return (
      <div className="min-w-[14rem] flex-1">
        <AutomationEntitySelect
          kind={kind}
          listPath={listPath}
          listQuery={listQuery}
          value={typeof condition.value === 'string' ? condition.value : ''}
          onChange={onChange}
          disabled={readOnly}
        />
      </div>
    );
  }

  if (field.type === 'enum') {
    return (
      <select
        className={selectCls}
        value={typeof condition.value === 'string' ? condition.value : ''}
        disabled={readOnly}
        onChange={(e) => onChange(e.target.value)}
      >
        <option value="">{t('automation.selectValue')}</option>
        {(field.enumValues ?? []).map((option) => (
          <option key={option} value={option}>
            {enumLabel(t, option)}
          </option>
        ))}
      </select>
    );
  }

  if (field.type === 'boolean') {
    return (
      <select
        className={selectCls}
        value={condition.value === true ? 'true' : condition.value === false ? 'false' : ''}
        disabled={readOnly}
        onChange={(e) => onChange(e.target.value === '' ? '' : e.target.value === 'true')}
      >
        <option value="">{t('automation.selectValue')}</option>
        <option value="true">{t('automation.yes')}</option>
        <option value="false">{t('automation.no')}</option>
      </select>
    );
  }

  if (field.type === 'date') {
    const raw = typeof condition.value === 'string' ? condition.value.slice(0, 10) : '';
    return (
      <Input
        className="h-9 w-40"
        type="date"
        value={raw}
        disabled={readOnly}
        onChange={(e) => onChange(e.target.value)}
      />
    );
  }

  const numeric = field.type === 'number' || field.type === 'money';
  return (
    <div className="flex min-w-[9rem] flex-1 flex-col gap-1">
      <Input
        className="h-9 w-full"
        type={numeric ? 'number' : 'text'}
        value={condition.value == null ? '' : String(condition.value)}
        disabled={readOnly}
        dir={numeric || /id|number|code/i.test(field.key) ? 'ltr' : undefined}
        onChange={(e) => {
          if (numeric) {
            const next = e.target.value;
            onChange(next === '' ? '' : Number(next));
            return;
          }
          onChange(e.target.value);
        }}
      />
      {field.type === 'money' && field.currencyField ? (
        <span className="text-[11px] text-foreground-muted">{t('automation.moneyUsesCurrency')}</span>
      ) : null}
    </div>
  );
}

export function ConditionGroup({ eventType, conditions, onChange, readOnly }: Props) {
  const { t } = useI18n();
  const { data } = useAutomationMetadataQuery();
  const metadata = data?.data;
  const event = findEvent(metadata, eventType);

  if (!event) {
    return (
      <div className="flex flex-col gap-2 opacity-60">
        <div>
          <span className="text-xs font-bold uppercase tracking-wide text-foreground-muted">{t('automation.ifLabel')}</span>
          <p className="text-xs text-foreground-muted">{t('automation.ifPrompt')}</p>
        </div>
        <p className="rounded-xl border border-dashed border-border bg-surface-1 p-3 text-xs text-foreground-muted">
          {t('automation.pickWhenFirst')}
        </p>
      </div>
    );
  }

  const addCondition = () => {
    const field = event.fields[0];
    if (!field) return;
    const operator = (field.operators[0] ?? 'eq') as AutomationConditionOperator;
    onChange([...conditions, { field: field.key, operator, value: blankValue(field, operator) }]);
  };

  const updateCondition = (index: number, patch: Partial<AutomationCondition>) => {
    onChange(conditions.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  };

  return (
    <div className="flex flex-col gap-2">
      <div>
        <span className="text-xs font-bold uppercase tracking-wide text-foreground-muted">{t('automation.ifLabel')}</span>
        <p className="text-xs text-foreground-muted">{t('automation.ifPrompt')}</p>
      </div>

      {conditions.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border bg-surface-1 p-3 text-xs text-foreground-muted">
          {t('automation.noConditions')}
        </p>
      ) : (
        <div className="flex flex-col gap-2">
          {conditions.map((condition, index) => {
            const field = event.fields.find((item) => item.key === condition.field) ?? event.fields[0];
            const operators = field?.operators ?? [];
            const entityMeta = metadata?.entityTypes?.find(
              (item) => item.type === fieldEntityKind(field ?? { entityType: undefined })
            );
            const listPath = entityMeta?.listPath;
            const listQuery = entityMeta?.query;
            return (
              <div key={`${condition.field}-${index}`} className="flex flex-col gap-2">
                {index > 0 ? <span className="text-[11px] font-bold text-foreground-muted">{t('automation.and')}</span> : null}
                <div className="flex flex-wrap items-center gap-2 rounded-xl border border-border bg-surface-1 p-2.5">
                  <select
                    className={selectCls}
                    value={condition.field}
                    disabled={readOnly}
                    onChange={(e) => {
                      const nextField = event.fields.find((item) => item.key === e.target.value);
                      if (!nextField) return;
                      const operator = (nextField.operators.includes(condition.operator)
                        ? condition.operator
                        : nextField.operators[0] ?? 'eq') as AutomationConditionOperator;
                      updateCondition(index, { field: nextField.key, operator, value: blankValue(nextField, operator) });
                    }}
                  >
                    {event.fields.map((item) => (
                      <option key={item.key} value={item.key}>
                        {catalogText(t, item.labelKey)}
                      </option>
                    ))}
                  </select>
                  <select
                    className={selectCls}
                    value={condition.operator}
                    disabled={readOnly}
                    onChange={(e) => {
                      const operator = e.target.value as AutomationConditionOperator;
                      const wasIn = condition.operator === 'in';
                      const nowIn = operator === 'in';
                      let value = condition.value;
                      if (nowIn && !wasIn) value = condition.value === '' || condition.value == null ? [] : [condition.value];
                      if (!nowIn && wasIn) value = Array.isArray(condition.value) ? (condition.value[0] ?? '') : condition.value;
                      updateCondition(index, { operator, value });
                    }}
                  >
                    {operators.map((op) => (
                      <option key={op} value={op}>
                        {operatorLabel(t, op, field?.type)}
                      </option>
                    ))}
                  </select>
                  {field ? (
                    <ConditionValue
                      field={field}
                      condition={condition}
                      readOnly={readOnly}
                      listPath={listPath}
                      listQuery={listQuery}
                      onChange={(value) => updateCondition(index, { value })}
                    />
                  ) : null}
                  {!readOnly ? (
                    <button
                      type="button"
                      onClick={() => onChange(conditions.filter((_, i) => i !== index))}
                      aria-label={t('automation.removeCondition')}
                      className="ms-auto rounded-lg p-1.5 text-foreground-muted hover:bg-surface-2 hover:text-danger"
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

      {!readOnly && event.fields.length > 0 ? (
        <button
          type="button"
          onClick={addCondition}
          className="mt-1 inline-flex w-fit items-center gap-1.5 rounded-lg px-2 py-1.5 text-sm font-semibold text-primary hover:bg-surface-2"
        >
          <Plus className="h-4 w-4" aria-hidden />
          {t('automation.addCondition')}
        </button>
      ) : null}
    </div>
  );
}
