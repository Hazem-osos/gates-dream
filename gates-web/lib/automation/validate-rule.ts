import { catalogText } from './labels';
import type { AutomationAction, AutomationCondition } from './types';
import {
  actionUnavailableReasonKey,
  compatibleBindFields,
  creatableEvents,
  findActionDef,
  findEvent,
  isEventFieldBinding,
  type AutomationMetadata,
} from './metadata';

type Translate = (key: string, vars?: Record<string, string | number>) => string;

function isBlank(value: unknown): boolean {
  return value === undefined || value === null || value === '';
}

export function missingRequiredConfig(
  metadata: AutomationMetadata | undefined,
  eventType: string | null,
  actions: AutomationAction[]
): string[] {
  const event = findEvent(metadata, eventType);
  const missing: string[] = [];
  for (const action of actions) {
    const def = findActionDef(metadata, action.type);
    if (!def) continue;
    for (const field of def.config) {
      if (!field.required) continue;
      const raw = action.config?.[field.key];
      if (isBlank(raw)) missing.push(field.labelKey);
      else if (isEventFieldBinding(raw) && !compatibleBindFields(event, field).some((f) => f.key === raw.field)) {
        missing.push(field.labelKey);
      }
    }
  }
  return missing;
}

export function validateAutomationDraft(
  t: Translate,
  metadata: AutomationMetadata | undefined,
  input: {
    name: string;
    eventType: string | null;
    conditions: AutomationCondition[];
    actions: AutomationAction[];
  }
): string | null {
  if (!metadata) return t('automation.metadataRequired');
  if (!input.name.trim()) return t('automation.nameRequired');
  if (!input.eventType) return t('automation.whenRequired');

  const creatable = creatableEvents(metadata).some((event) => event.eventType === input.eventType);
  if (!creatable) return t('automation.eventUnsupported');

  const event = findEvent(metadata, input.eventType);
  if (!event) return t('automation.eventUnsupported');

  for (const condition of input.conditions) {
    const field = event.fields.find((item) => item.key === condition.field);
    if (!field) return t('automation.conditionFieldUnsupported');
    if (!field.operators.includes(condition.operator)) return t('automation.operatorUnsupported');
    if (condition.operator === 'in' && !Array.isArray(condition.value)) {
      return t('automation.conditionValueInvalid');
    }
    if (isBlank(condition.value) || (Array.isArray(condition.value) && condition.value.length === 0)) {
      return t('automation.conditionValueRequired');
    }
    if (
      (field.type === 'number' || field.type === 'money') &&
      (typeof condition.value !== 'number' || !Number.isFinite(condition.value))
    ) {
      return t('automation.conditionValueInvalid');
    }
    if (field.type === 'boolean' && typeof condition.value !== 'boolean') {
      return t('automation.conditionValueInvalid');
    }
    if (field.type === 'enum') {
      const allowed = new Set(field.enumValues ?? []);
      const values = Array.isArray(condition.value) ? condition.value : [condition.value];
      if (values.some((value) => typeof value !== 'string' || !allowed.has(value))) {
        return t('automation.conditionValueInvalid');
      }
    }
    if (field.type === 'entity') {
      const values = Array.isArray(condition.value) ? condition.value : [condition.value];
      const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (values.some((value) => typeof value !== 'string' || !uuid.test(value))) {
        return t('automation.entityRequired');
      }
    }
  }

  if (input.actions.length === 0) return t('automation.thenRequired');

  for (const action of input.actions) {
    const def = findActionDef(metadata, action.type);
    if (!def) return t('automation.actionUnsupported');
    const unavailable = actionUnavailableReasonKey(metadata, action.type);
    if (unavailable) return catalogText(t, unavailable);

    const config = action.config ?? {};
    const allowed = new Set(def.config.map((field) => field.key));
    for (const key of Object.keys(config)) {
      if (!allowed.has(key)) return t('automation.unknownConfig');
    }
    for (const field of def.config) {
      const raw = config[field.key];
      if (field.required && isBlank(raw)) return t('automation.actionConfigRequired');
      if (isBlank(raw)) continue;
      if (isEventFieldBinding(raw)) {
        if (!field.bindable) return t('automation.bindingNotAllowed');
        const match = compatibleBindFields(event, field).some((item) => item.key === raw.field);
        if (!match) return t('automation.bindingIncompatible');
        continue;
      }
      if (field.type === 'entity' && (typeof raw !== 'string' || !raw.trim())) {
        return t('automation.entityRequired');
      }
      if (field.type === 'number' && (typeof raw !== 'number' || !Number.isFinite(raw))) {
        return t('automation.conditionValueInvalid');
      }
      if (field.type === 'number' && typeof raw === 'number' && field.min != null && raw < field.min) {
        return t('automation.valueBelowMin');
      }
      if (field.type === 'enum' && (typeof raw !== 'string' || !field.enumValues?.includes(raw))) {
        return t('automation.conditionValueInvalid');
      }
      if (field.type === 'boolean' && typeof raw !== 'boolean') return t('automation.conditionValueInvalid');
      if (field.type === 'date') {
        if (typeof raw !== 'string' || Number.isNaN(new Date(raw).getTime())) {
          return t('automation.conditionValueInvalid');
        }
      }
      if (field.type === 'string' && typeof raw !== 'string') {
        return t('automation.conditionValueInvalid');
      }
      if (typeof raw === 'string' && field.maxLength && raw.length > field.maxLength) {
        return t('automation.valueTooLong');
      }
    }
  }

  return null;
}
