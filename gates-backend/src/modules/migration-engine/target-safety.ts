const PRODUCTION_HOST_PATTERNS = [
  /railway\.app/i,
  /rlwy\.net/i,
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
