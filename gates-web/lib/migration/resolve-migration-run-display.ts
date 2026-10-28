import type { MigrationProgressSnapshot } from '@/lib/migration/migration-types';
import { explainMigrationEngineAlert } from '@/lib/migration/capability-messages';

export type MigrationRunDisplay = {
  statusKey: string;
  label: string;
  active: boolean;
  lastError: string | null;
  lastEnqueuedAt: string | null;
};

const STATUS_LABEL: Record<string, string> = {
  DRAFT: 'مسودة',
  QUEUED: 'في الانتظار',
  ANALYZING: 'تحليل',
  READY_FOR_DRY_RUN: 'جاهز للمعاينة',
  DRY_RUNNING: 'معاينة جافة',
  READY: 'جاهز للتنفيذ',
  RUNNING: 'ترحيل',
  RECONCILING: 'مطابقة',
  COMPLETED: 'مكتمل',
  FAILED: 'فشل',
  BLOCKED: 'محظور',
  PAUSED: 'متوقف',
};

function uiString(ui: Record<string, unknown> | null | undefined, key: string): string | null {
  const v = ui?.[key];
  return typeof v === 'string' && v.trim() ? v.trim() : null;
}

export function resolveMigrationRunDisplay(
  progress: MigrationProgressSnapshot | null
): MigrationRunDisplay {
  const ui = progress?.ui ?? null;
  const lastErrorRaw = uiString(ui, 'lastError');
  const lastError = lastErrorRaw ? explainMigrationEngineAlert(lastErrorRaw) : null;
  const lastEnqueuedAt = uiString(ui, 'lastEnqueuedAt');
  const raw = progress?.status ?? 'DRAFT';

  if (lastError && (raw === 'DRAFT' || raw === 'FAILED')) {
    return {
      statusKey: 'FAILED',
      label: STATUS_LABEL.FAILED,
      active: false,
      lastError,
      lastEnqueuedAt,
    };
  }

  if (raw === 'DRAFT' && lastEnqueuedAt) {
    return {
      statusKey: 'QUEUED',
      label: STATUS_LABEL.QUEUED,
      active: true,
      lastError: null,
      lastEnqueuedAt,
    };
  }

  return {
    statusKey: raw,
    label: STATUS_LABEL[raw] ?? raw,
    active: ['RUNNING', 'DRY_RUNNING', 'ANALYZING', 'RECONCILING', 'QUEUED'].includes(raw),
    lastError,
    lastEnqueuedAt,
  };
}
