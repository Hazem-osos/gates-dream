import type { AutomationCondition, AutomationRunStatus } from './types';
import { OPERATOR_LABELS, findAction, findTrigger, findTriggerField } from './catalog';

/** "الكمية المتاحة أقل من 10" — never show raw field.operator.value. */
export function describeCondition(condition: AutomationCondition, eventType: string): string {
  const trigger = findTrigger(eventType);
  const field = findTriggerField(trigger, condition.field);
  const fieldLabel = field?.label ?? condition.field;
  const opLabel = OPERATOR_LABELS[condition.operator] ?? condition.operator;
  const value = Array.isArray(condition.value) ? condition.value.join('، ') : String(condition.value ?? '');
  return `${fieldLabel} ${opLabel} ${value}`.trim();
}

export function describeTrigger(eventType: string): string {
  return findTrigger(eventType)?.label ?? eventType;
}

export function describeActionSummary(actionType: string, config?: Record<string, unknown>): string {
  const action = findAction(actionType);
  if (!action) return actionType;
  if (!config) return action.label;
  const bits: string[] = [];
  if (typeof config.description === 'string' && config.description.trim()) {
    bits.push(config.description.trim());
  }
  return bits.length ? `${action.label} — ${bits.join('، ')}` : action.label;
}

export const RUN_STATUS_LABEL: Record<AutomationRunStatus, string> = {
  SUCCEEDED: 'نجحت',
  FAILED: 'فشلت',
  PENDING: 'قيد التنفيذ',
};

export function runStatusTone(status: AutomationRunStatus): 'success' | 'danger' | 'warning' {
  if (status === 'SUCCEEDED') return 'success';
  if (status === 'FAILED') return 'danger';
  return 'warning';
}

/** Friendly relative time in Arabic — "منذ 4 دقائق"، "أمس"، إلخ. */
export function formatRelativeTimeAr(iso: string | null | undefined): string {
  if (!iso) return '—';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '—';
  const diffMs = Date.now() - date.getTime();
  const diffSec = Math.round(diffMs / 1000);

  if (diffSec < 5) return 'منذ لحظات';
  if (diffSec < 60) return `منذ ${diffSec} ثانية`;
  const diffMin = Math.round(diffSec / 60);
  if (diffMin < 60) return `منذ ${diffMin} دقيقة`;
  const diffHour = Math.round(diffMin / 60);
  if (diffHour < 24) return `منذ ${diffHour} ساعة`;
  const diffDay = Math.round(diffHour / 24);
  if (diffDay === 1) return 'أمس';
  if (diffDay < 7) return `منذ ${diffDay} أيام`;
  return date.toLocaleDateString('ar-EG', { day: 'numeric', month: 'short', year: 'numeric' });
}

/** "أُكملت في 1.2 ثانية" from two ISO timestamps. */
export function formatDurationAr(startedAt: string, completedAt: string | null): string | null {
  if (!completedAt) return null;
  const ms = new Date(completedAt).getTime() - new Date(startedAt).getTime();
  if (!Number.isFinite(ms) || ms < 0) return null;
  if (ms < 1000) return `${ms} جزء من الثانية`;
  return `${(ms / 1000).toFixed(1)} ثانية`;
}

/** Friendly, non-technical error message. Never surfaces stack traces / internal URLs. */
export function friendlyRunError(run: {
  errorMessage: string | null;
  lastErrorCode: string | null;
}): string {
  if (run.lastErrorCode === 'OWNERSHIP') {
    return 'أحد العناصر المرتبطة (المورد أو المخزن) لم يعد موجودًا أو غير متاح لهذه الشركة.';
  }
  if (run.lastErrorCode === 'DRAFT_POLICY') {
    return 'تعذر إنشاء المستند كمسودة بسبب إعدادات النظام.';
  }
  if (run.errorMessage) {
    // Backend errorMessage is already end-user text (never a stack trace or secret).
    return run.errorMessage;
  }
  return 'حدثت مشكلة غير متوقعة أثناء تنفيذ هذه الأتمتة.';
}
