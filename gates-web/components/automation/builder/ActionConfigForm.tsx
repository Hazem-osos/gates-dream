'use client';

import { useQuery } from '@tanstack/react-query';
import { Input } from '@/components/ui';
import { apiClient } from '@/lib/api/client';
import { selectableTemplates } from '@/lib/whatsapp/embedded-signup';
import { catalogText, enumLabel } from '@/lib/automation/labels';
import {
  actionUnavailableReasonKey,
  compatibleBindFields,
  fieldEntityKind,
  findEvent,
  isEventFieldBinding,
  recordsActionResult,
  type AutomationActionConfigField,
  type AutomationActionDef,
  type AutomationEventField,
} from '@/lib/automation/metadata';
import { useAutomationMetadataQuery } from '@/lib/hooks/useAutomationRules';
import { useI18n } from '@/lib/i18n';
import { AutomationEntitySelect } from './AutomationEntitySelect';

type Props = {
  action: AutomationActionDef;
  instanceId: string;
  eventType: string | null;
  config: Record<string, unknown>;
  onChange: (config: Record<string, unknown>) => void;
  readOnly?: boolean;
};

const selectCls =
  'h-9 w-full rounded-lg border border-border bg-surface-1 px-2 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/15';

function writeConfig(config: Record<string, unknown>, key: string, value: unknown): Record<string, unknown> {
  const next = { ...config };
  if (value === '' || value == null) delete next[key];
  else next[key] = value;
  return next;
}

function FixedControl({
  field,
  value,
  readOnly,
  listPath,
  listQuery,
  onChange,
}: {
  field: AutomationActionConfigField;
  value: unknown;
  readOnly?: boolean;
  listPath?: string;
  listQuery?: Record<string, string>;
  onChange: (value: unknown) => void;
}) {
  const { t } = useI18n();
  const kind = fieldEntityKind(field);
  const longText = field.type === 'string' && (field.maxLength ?? 0) >= 500;

  if (field.type === 'entity' && kind) {
    return (
      <AutomationEntitySelect
        kind={kind}
        listPath={listPath}
        listQuery={listQuery}
        value={typeof value === 'string' ? value : ''}
        onChange={onChange}
        disabled={readOnly}
      />
    );
  }

  if (field.type === 'enum') {
    return (
      <select
        className={selectCls}
        value={typeof value === 'string' ? value : ''}
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
        value={value === true ? 'true' : value === false ? 'false' : ''}
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
    const raw = typeof value === 'string' ? value.slice(0, 10) : '';
    return (
      <Input type="date" value={raw} disabled={readOnly} onChange={(e) => onChange(e.target.value)} />
    );
  }

  if (longText) {
    return (
      <textarea
        value={typeof value === 'string' ? value : ''}
        disabled={readOnly}
        maxLength={field.maxLength}
        rows={3}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-lg border border-border bg-surface-1 px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/15"
      />
    );
  }

  return (
    <Input
      type={field.type === 'number' ? 'number' : field.format === 'email' ? 'email' : field.format === 'url' ? 'url' : 'text'}
      value={value == null ? '' : String(value)}
      disabled={readOnly}
      dir={
        field.type === 'number' || field.format === 'url' || field.format === 'email' || /id|number|code|url/i.test(field.key)
          ? 'ltr'
          : undefined
      }
      maxLength={field.maxLength}
      onChange={(e) => {
        if (field.type === 'number') {
          const next = e.target.value;
          onChange(next === '' ? '' : Number(next));
          return;
        }
        onChange(e.target.value);
      }}
    />
  );
}

function BindingPicker({
  fields,
  selected,
  suggested,
  readOnly,
  onChange,
}: {
  fields: AutomationEventField[];
  selected: string;
  suggested?: string;
  readOnly?: boolean;
  onChange: (field: string) => void;
}) {
  const { t } = useI18n();
  const ordered = [...fields].sort((a, b) => {
    if (a.key === suggested) return -1;
    if (b.key === suggested) return 1;
    return 0;
  });
  const missingSelected = selected && !ordered.some((field) => field.key === selected);
  return (
    <select className={selectCls} value={selected} disabled={readOnly} onChange={(e) => onChange(e.target.value)}>
      <option value="">{t('automation.selectEventField')}</option>
      {missingSelected ? <option value={selected}>{selected}</option> : null}
      {ordered.map((field) => (
        <option key={field.key} value={field.key}>
          {t('automation.fromEventField', { field: catalogText(t, field.labelKey) })}
        </option>
      ))}
    </select>
  );
}

export function ActionConfigForm({ action, instanceId, eventType, config, onChange, readOnly }: Props) {
  const { t } = useI18n();
  const { data } = useAutomationMetadataQuery();
  const metadata = data?.data;
  const event = findEvent(metadata, eventType);
  const blocked = actionUnavailableReasonKey(metadata, action.type);
  const whatsappTemplates = useQuery({
    queryKey: ['company-whatsapp-templates', 'usable'],
    enabled: action.type === 'whatsapp.send' && !blocked,
    queryFn: () =>
      apiClient.get<Array<{ name: string; language: string; usable: boolean }>>('/company-whatsapp/templates?usable=1'),
  });
  const templateOptions = selectableTemplates(whatsappTemplates.data?.data ?? []);
  const external = !recordsActionResult(action);

  const set = (key: string, value: unknown) => onChange(writeConfig(config, key, value));

  return (
    <div className="flex flex-col gap-3">
      {blocked ? (
        <p className="rounded-lg border border-warning/30 bg-[var(--warning-soft,rgba(245,158,11,0.12))] px-3 py-2 text-xs font-medium text-foreground">
          {catalogText(t, blocked)}
        </p>
      ) : null}
      {external ? (
        <p className="rounded-lg border border-border bg-surface-2 px-3 py-2 text-xs text-foreground-muted">
          {t('automation.webhookNoHistory')}
        </p>
      ) : null}
      <div className="grid gap-3 sm:grid-cols-2">
        {action.config.map((field) => {
          const raw = config[field.key];
          const bound = isEventFieldBinding(raw);
          const options = compatibleBindFields(event, field);
          const canBind = field.bindable && options.length > 0;
          const suggested = action.suggestedEventBindings?.find(
            (item) => item.eventType === eventType && item.configKey === field.key
          )?.eventField;
          const entityMeta = metadata?.entityTypes?.find((item) => item.type === fieldEntityKind(field));
          const listPath = entityMeta?.listPath;
          const listQuery = entityMeta?.query;
          const wide = field.type === 'string' && (field.maxLength ?? 0) >= 500;
          return (
            <div key={field.key} className={wide ? 'sm:col-span-2' : undefined}>
              <label className="mb-1 block text-xs font-semibold text-foreground">
                {catalogText(t, field.labelKey)}
                {field.required ? <span className="ms-1 text-danger">*</span> : null}
              </label>
              {field.descriptionKey ? (
                <p className="mb-1 text-[11px] text-foreground-muted">{catalogText(t, field.descriptionKey)}</p>
              ) : null}
              {canBind ? (
                <div className="mb-2 flex flex-wrap gap-3 text-xs font-medium text-foreground">
                  <label className="inline-flex items-center gap-1.5">
                    <input
                      type="radio"
                      name={`${instanceId}-${field.key}-mode`}
                      checked={!bound}
                      disabled={readOnly || Boolean(blocked)}
                      onChange={() => set(field.key, field.default ?? '')}
                    />
                    {t('automation.fixedValue')}
                  </label>
                  <label className="inline-flex items-center gap-1.5">
                    <input
                      type="radio"
                      name={`${instanceId}-${field.key}-mode`}
                      checked={bound}
                      disabled={readOnly || Boolean(blocked)}
                      onChange={() => {
                        const fieldKey = (bound ? raw.field : undefined) || suggested || options[0]?.key;
                        if (fieldKey) set(field.key, { source: 'event', field: fieldKey });
                      }}
                    />
                    {t('automation.fromEvent')}
                  </label>
                </div>
              ) : null}
              {bound && !canBind ? (
                <div className="flex flex-col items-start gap-1">
                  <p className="text-xs text-danger">{t('automation.bindingIncompatible')}</p>
                  <button
                    type="button"
                    className="text-xs font-semibold text-primary"
                    onClick={() => set(field.key, field.default ?? '')}
                  >
                    {t('automation.fixedValue')}
                  </button>
                </div>
              ) : null}
              {!bound && action.type === 'whatsapp.send' && field.key === 'templateName' ? (
                <select
                  className={selectCls}
                  value={typeof raw === 'string' ? raw : ''}
                  disabled={readOnly || Boolean(blocked)}
                  onChange={(e) => {
                    const name = e.target.value;
                    const match = templateOptions.find((row) => row.name === name);
                    const next = writeConfig(config, field.key, name);
                    if (match) onChange(writeConfig(next, 'templateLanguage', match.language));
                    else onChange(next);
                  }}
                >
                  <option value="">{t('automation.fields.whatsappTemplate')}</option>
                  {templateOptions.map((row) => (
                    <option key={`${row.name}:${row.language}`} value={row.name}>
                      {row.name} ({row.language})
                    </option>
                  ))}
                </select>
              ) : bound && canBind ? (
                <BindingPicker
                  fields={options.some((item) => item.key === raw.field) ? options : [...options]}
                  selected={raw.field}
                  suggested={suggested}
                  readOnly={readOnly || Boolean(blocked)}
                  onChange={(fieldKey) => set(field.key, { source: 'event', field: fieldKey })}
                />
              ) : (
                <FixedControl
                  field={field}
                  value={bound ? '' : raw}
                  readOnly={readOnly || Boolean(blocked)}
                  listPath={listPath}
                  listQuery={listQuery}
                  onChange={(value) => set(field.key, value)}
                />
              )}
              {!bound && field.key !== 'templateName' && field.type === 'string' && event?.fields.length ? (
                <select
                  className={`${selectCls} mt-2`}
                  value=""
                  disabled={readOnly || Boolean(blocked)}
                  onChange={(e) => {
                    const key = e.target.value;
                    if (!key) return;
                    const current = typeof raw === 'string' ? raw : '';
                    set(field.key, `${current}{{${key}}}`);
                  }}
                >
                  <option value="">{t('automation.insertVariable')}</option>
                  {event.fields.map((item) => (
                    <option key={item.key} value={item.key}>
                      {catalogText(t, item.labelKey)}
                    </option>
                  ))}
                </select>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}
