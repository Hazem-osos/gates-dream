import { catalogText, operatorLabel } from './labels';
import { findActionDef, findEvent, isEventFieldBinding, type AutomationMetadata } from './metadata';
import type { AutomationCondition, AutomationRunStatus } from './types';

type Translate = (key: string, vars?: Record<string, string | number>) => string;

export function describeCondition(
  t: Translate,
  metadata: AutomationMetadata | undefined,
  eventType: string,
  condition: AutomationCondition
): string {
  const event = findEvent(metadata, eventType);
  const field = event?.fields.find((item) => item.key === condition.field);
  const fieldLabel = catalogText(t, field?.labelKey) || condition.field;
  const opLabel = operatorLabel(t, condition.operator, field?.type);
  const raw = condition.value;
  const value = Array.isArray(raw) ? raw.map(String).join(', ') : String(raw ?? '');
  return `${fieldLabel} ${opLabel} ${value}`.trim();
}

export function describeTrigger(
  t: Translate,
  metadata: AutomationMetadata | undefined,
  eventType: string | null | undefined
): string {
  const event = findEvent(metadata, eventType);
  return event ? catalogText(t, event.labelKey) : eventType || '';
}

export function describeActionLabel(
  t: Translate,
  metadata: AutomationMetadata | undefined,
  actionType: string | null | undefined
): string {
  const action = findActionDef(metadata, actionType);
  return action ? catalogText(t, action.labelKey) : actionType || '';
}

export function describeConfigValue(
  t: Translate,
  value: unknown,
  metadata?: AutomationMetadata,
  eventType?: string | null
): string {
  if (isEventFieldBinding(value)) {
    const event = findEvent(metadata, eventType);
    const field = event?.fields.find((item) => item.key === value.field);
    const label = field ? catalogText(t, field.labelKey) : value.field;
    return t('automation.fromEventField', { field: label });
  }
  if (value == null || value === '') return '';
  if (typeof value === 'boolean') return value ? t('automation.yes') : t('automation.no');
  return String(value);
}

export function runStatusLabel(t: Translate, status: AutomationRunStatus): string {
  return t(`automation.runStatus.${status}`);
}

export function runStatusTone(status: AutomationRunStatus): 'success' | 'danger' | 'warning' {
  if (status === 'SUCCEEDED') return 'success';
  if (status === 'FAILED') return 'danger';
  return 'warning';
}

export function formatRelativeTime(iso: string | null | undefined, locale: string): string {
  if (!iso) return '—';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '—';
  const diffSec = Math.round((date.getTime() - Date.now()) / 1000);
  const rtf = new Intl.RelativeTimeFormat(locale === 'ar' ? 'ar' : 'en', { numeric: 'auto' });
  const abs = Math.abs(diffSec);
  if (abs < 60) return rtf.format(Math.round(diffSec), 'second');
  const diffMin = Math.round(diffSec / 60);
  if (Math.abs(diffMin) < 60) return rtf.format(diffMin, 'minute');
  const diffHour = Math.round(diffMin / 60);
  if (Math.abs(diffHour) < 24) return rtf.format(diffHour, 'hour');
  const diffDay = Math.round(diffHour / 24);
  if (Math.abs(diffDay) < 30) return rtf.format(diffDay, 'day');
  return date.toLocaleDateString(locale === 'ar' ? 'ar-EG' : 'en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

export function formatDuration(
  t: Translate,
  startedAt: string,
  completedAt: string | null
): string | null {
  if (!completedAt) return null;
  const ms = new Date(completedAt).getTime() - new Date(startedAt).getTime();
  if (!Number.isFinite(ms) || ms < 0) return null;
  if (ms < 1000) return t('automation.durationMs', { ms });
  return t('automation.durationSec', { sec: (ms / 1000).toFixed(1) });
}

export function friendlyRunError(
  t: Translate,
  run: { errorMessage: string | null; lastErrorCode: string | null }
): string {
  if (run.lastErrorCode === 'OWNERSHIP') return t('automation.errors.ownership');
  if (run.lastErrorCode === 'DRAFT_POLICY') return t('automation.errors.draftPolicy');
  if (run.errorMessage) return run.errorMessage;
  return t('automation.errors.unexpected');
}

const SAFE_RESULT_KEYS = new Set([
  'orderNumber',
  'purchaseOrderId',
  'notificationId',
  'duplicate',
  'id',
]);

export function safeResultEntries(metadata: Record<string, unknown> | null | undefined): Array<[string, string]> {
  if (!metadata) return [];
  return Object.entries(metadata)
    .filter(([key, value]) => SAFE_RESULT_KEYS.has(key) && (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean'))
    .map(([key, value]) => [key, String(value)]);
}
