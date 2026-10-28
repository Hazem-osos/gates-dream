const PRODUCTION_HOST_PATTERNS = [
  /railway\.app/i,
  /rlwy\.net/i,
  // Railway private network (the live app's own DATABASE_URL is mysql.railway.internal).
  /railway\.internal/i,
  /\.prod\./i,
  /production/i,
];

const LOCAL_HOST_PATTERNS = [/localhost/i, /127\.0\.0\.1/i, /@mysql:/i];

export class MigrationTargetSafetyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'MigrationTargetSafetyError';
  }
}

export function assertMigrationEngineEnabled(): void {
  const flag = process.env.MIGRATION_ENGINE_ENABLED?.trim().toLowerCase();
  if (flag !== 'true' && flag !== '1') {
    throw new MigrationTargetSafetyError(
      'Migration engine is disabled. Set MIGRATION_ENGINE_ENABLED=true for local pilot only.'
    );
  }
}

export function assertSafeTargetDatabaseUrl(databaseUrl: string): void {
  assertMigrationEngineEnabled();

  if (process.env.MIGRATION_ALLOW_PRODUCTION_TARGET === 'true') {
    return;
  }

  let host = '';
  try {
    const normalized = databaseUrl.replace(/^mysql:\/\//, 'http://');
    host = new URL(normalized).hostname;
  } catch {
    throw new MigrationTargetSafetyError('Invalid DATABASE_URL for migration target.');
  }

  for (const pattern of PRODUCTION_HOST_PATTERNS) {
    if (pattern.test(databaseUrl) || pattern.test(host)) {
      throw new MigrationTargetSafetyError(
        `Target DATABASE_URL appears to be production (${host}). Migration writes are prohibited.`
      );
    }
  }

  const isLocal = LOCAL_HOST_PATTERNS.some((p) => p.test(databaseUrl) || p.test(host));
  if (!isLocal && process.env.NODE_ENV === 'production') {
    throw new MigrationTargetSafetyError(
      'Migration target must be local/disposable unless MIGRATION_ALLOW_PRODUCTION_TARGET=true (cutover gate — not for Phase 1).'
    );
  }
}

export function assertSafeLegacyReadOnly(): void {
  if (process.env.MIGRATION_LEGACY_WRITABLE === 'true') {
    throw new MigrationTargetSafetyError('Legacy source must remain read-only.');
  }
}

/** Execute/auto stay off until an explicit internal-testing flag (and optional user allowlist). */
export function customerExecuteAllowed(userId?: string): boolean {
  if (process.env.MIGRATION_CUSTOMER_EXECUTE_ENABLED !== 'true') return false;
  const allow = (process.env.MIGRATION_INTERNAL_TEST_USER_IDS ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  if (allow.length === 0) return true;
  return Boolean(userId && allow.includes(userId));
}

export function assertCustomerExecuteAllowed(userId?: string): void {
  if (customerExecuteAllowed(userId)) return;
  throw new MigrationTargetSafetyError(
    'تنفيذ الترحيل غير مفعّل للاختبار الداخلي. التحليل والمعاينة متاحان. لا يُكتب على قاعدة الإنتاج حتى يُفعَّل MIGRATION_CUSTOMER_EXECUTE_ENABLED لحساب اختبار وعلى هدف غير إنتاجي.'
  );
}
