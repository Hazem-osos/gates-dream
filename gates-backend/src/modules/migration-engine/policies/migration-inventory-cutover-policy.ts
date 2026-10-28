export const MIGRATION_INVENTORY_CUTOVER_POLICIES = [
  'PERIODIC_LEGACY_NO_INV_GL_REPOST',
  'PERPETUAL_MAC_SUBLEDGER_ONLY',
  'PERPETUAL_WITH_OWNER_OPENING_STOCK_JE',
] as const;

export type MigrationInventoryCutoverPolicy = (typeof MIGRATION_INVENTORY_CUTOVER_POLICIES)[number];

/** Safe default for operator-led cutover — no automatic inventory GL repost. */
export const DEFAULT_MIGRATION_INVENTORY_CUTOVER_POLICY: MigrationInventoryCutoverPolicy =
  'PERIODIC_LEGACY_NO_INV_GL_REPOST';

export function readInventoryCutoverPolicy(progress: unknown): MigrationInventoryCutoverPolicy | null {
  if (!progress || typeof progress !== 'object' || Array.isArray(progress)) return null;
  const raw = (progress as Record<string, unknown>).inventoryCutoverPolicy;
  if (typeof raw !== 'string') return null;
  return (MIGRATION_INVENTORY_CUTOVER_POLICIES as readonly string[]).includes(raw)
    ? (raw as MigrationInventoryCutoverPolicy)
    : null;
}

export function resolveInventoryCutoverPolicyForRun(progress: unknown): {
  policy: MigrationInventoryCutoverPolicy | null;
  source: 'job' | 'env' | 'unset';
  label: string;
} {
  const fromJob = readInventoryCutoverPolicy(progress);
  if (fromJob) {
    return { policy: fromJob, source: 'job', label: fromJob };
  }
  const env = process.env.MIGRATION_INVENTORY_VALUATION_POLICY?.trim();
  if (env && (MIGRATION_INVENTORY_CUTOVER_POLICIES as readonly string[]).includes(env)) {
    return { policy: env as MigrationInventoryCutoverPolicy, source: 'env', label: env };
  }
  return {
    policy: null,
    source: 'unset',
    label: 'Inventory cutover policy not selected — choose on migration page before activation',
  };
}

export function inventoryPolicyBlocksActivation(progress: unknown): string | null {
  const { policy, source } = resolveInventoryCutoverPolicyForRun(progress);
  if (policy) return null;
  if (source === 'env') return null;
  return 'Select inventory accounting cutover policy on the database migration page before activation.';
}

/** Ensures every migration job has an inventory cutover policy (operator default). */
export function applyDefaultInventoryCutoverPolicyToProgress(progress: unknown): Record<string, unknown> {
  const current =
    progress && typeof progress === 'object' && !Array.isArray(progress)
      ? { ...(progress as Record<string, unknown>) }
      : {};
  if (readInventoryCutoverPolicy(current)) return current;
  return { ...current, inventoryCutoverPolicy: DEFAULT_MIGRATION_INVENTORY_CUTOVER_POLICY };
}
