/**
 * Safe V1 event-field binding mechanism.
 *
 * Action config values are either a constant (plain string/number/boolean),
 * or an explicit reference to a field on the triggering event's payload:
 *
 *   { "source": "event", "field": "shortageQuantity" }
 *
 * There is no arbitrary expression language, no code evaluation, and no
 * templating engine — only this one explicit, typed reference shape.
 */
import { getEventField } from './event-catalog';
import { fieldTypesCompatible, type EntityKind, type EventFieldType } from './field-types';

export interface EventFieldBinding {
  source: 'event';
  field: string;
}

export function isEventFieldBinding(value: unknown): value is EventFieldBinding {
  return (
    typeof value === 'object' &&
    value !== null &&
    (value as Record<string, unknown>).source === 'event' &&
    typeof (value as Record<string, unknown>).field === 'string' &&
    ((value as Record<string, unknown>).field as string).trim().length > 0
  );
}

export type BindingValidation = { ok: true } | { ok: false; message: string };

export type BindingTarget = {
  key?: string;
  type: EventFieldType;
  entityKind?: EntityKind;
};

/** The referenced field must exist on the event and match the config field's type. */
export function validateBindingAgainstEvent(
  binding: EventFieldBinding,
  eventType: string,
  target?: BindingTarget
): BindingValidation {
  const field = getEventField(eventType, binding.field);
  if (!field) {
    return {
      ok: false,
      message: `Event field "${binding.field}" does not exist on event "${eventType}"`,
    };
  }
  if (target && !fieldTypesCompatible(field, target)) {
    return {
      ok: false,
      message: `Event field "${binding.field}" is not compatible with config field "${target.key ?? target.type}"`,
    };
  }
  return { ok: true };
}

/**
 * Resolve a bound/constant config value against a real event payload at
 * execution time (used by GATES-executed actions, e.g. gates.createNotification).
 * Unknown/missing event fields resolve to undefined rather than throwing —
 * the action handler decides whether that violates a required field.
 */
export function resolveConfigValue(
  raw: unknown,
  eventData: Record<string, unknown> | undefined
): unknown {
  if (isEventFieldBinding(raw)) {
    return eventData ? eventData[raw.field] : undefined;
  }
  return raw;
}
