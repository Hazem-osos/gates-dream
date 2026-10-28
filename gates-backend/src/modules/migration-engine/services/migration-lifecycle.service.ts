export const MIGRATION_LIFECYCLE_PHASES = [
  'UPLOADED',
  'CONNECTED',
  'ANALYZED',
  'DRY_RUN',
  'MIGRATED',
  'RECONCILED',
  'ACTIVATED',
] as const;

export type MigrationLifecyclePhase = (typeof MIGRATION_LIFECYCLE_PHASES)[number];

export type MigrationLifecycleState = {
  phase: MigrationLifecyclePhase;
  updatedAt: string;
  reconciliationPass?: boolean;
  activatedAt?: string;
  activatedByUserId?: string;
  notes?: string;
};

export function readLifecycle(progress: unknown): MigrationLifecycleState | null {
  if (!progress || typeof progress !== 'object' || Array.isArray(progress)) return null;
  const lifecycle = (progress as Record<string, unknown>).lifecycle;
  if (!lifecycle || typeof lifecycle !== 'object' || Array.isArray(lifecycle)) return null;
  const phase = (lifecycle as Record<string, unknown>).phase;
  if (typeof phase !== 'string') return null;
  return lifecycle as MigrationLifecycleState;
}

export function mergeLifecyclePatch(
  progress: unknown,
  patch: Partial<MigrationLifecycleState>
): Record<string, unknown> {
  const base =
    progress && typeof progress === 'object' && !Array.isArray(progress)
      ? { ...(progress as Record<string, unknown>) }
      : {};
  const prev = readLifecycle(base) ?? { phase: 'CONNECTED' as MigrationLifecyclePhase, updatedAt: new Date().toISOString() };
  base.lifecycle = {
    ...prev,
    ...patch,
    updatedAt: new Date().toISOString(),
  };
  return base;
}
