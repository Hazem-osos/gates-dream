import { z } from 'zod';

/** Treat blank env as unset so `.url()` does not fail on `VAR=` */
function optionalEnvUrl() {
  return z.preprocess(
    (v) => (v === '' || v === null || typeof v === 'undefined' ? undefined : v),
    z.string().url().optional()
  );
}

/** Optional string, treating `''`/unset as `undefined` rather than an empty string. */
function optionalEnvString() {
  return z.preprocess(
    (v) => (v === '' || v === null || typeof v === 'undefined' ? undefined : v),
    z.string().optional()
  );
}

/** Boolean flag that defaults to `false` unless explicitly set to a truthy value. */
function optionalEnvBoolean() {
  return z
    .string()
    .optional()
    .transform((val) => ['true', '1', 'yes', 'on'].includes((val ?? '').trim().toLowerCase()));
}

/**
 * Environment Variable Validation
 * Validates all required environment variables on application startup
 * Throws error if any required variable is missing or invalid
 */
const envSchema = z.object({
  // Node Environment
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.string().default('3001').transform(Number),

  // Database
  DATABASE_URL: z.string().url('DATABASE_URL must be a valid URL'),

  // Wave 6 fix: this used to default to `true` whenever the var was unset —
  // so a fresh checkout with no `.env` (or one missing this line) silently
  // tried to authenticate against Keycloak instead of the local-JWT path
  // `.env.example` documents as the actual default (`KEYCLOAK_ENABLED=false`).
  // Only an explicit truthy value now turns Keycloak on.
  KEYCLOAK_ENABLED: z.preprocess((v) => {
    if (v === '' || v === null || typeof v === 'undefined') return false;
    const s = String(v).trim().toLowerCase();
    return ['true', '1', 'yes', 'on'].includes(s);
  }, z.boolean()),
  KEYCLOAK_SERVER_URL: optionalEnvUrl(),
  KEYCLOAK_REALM: z.string().optional(),
  KEYCLOAK_CLIENT_ID: z.string().optional(),
  KEYCLOAK_CLIENT_SECRET: z.string().optional(),

  /** HS256 secret for POST /auth/login when Keycloak is disabled (local dev only). */
  JWT_DEV_SECRET: z.preprocess(
    (v) => (v === '' || v === null || typeof v === 'undefined' ? undefined : v),
    z.string().min(16, 'JWT_DEV_SECRET must be at least 16 characters when set').optional()
  ),

  /** Company new dev users attach to when POST /auth/register is used (optional; else first active company or seed id). */
  DEFAULT_REGISTRATION_COMPANY_ID: z.preprocess(
    (v) => (v === '' || v === null || typeof v === 'undefined' ? undefined : v),
    z.string().uuid().optional()
  ),

  // Frontend URL (for CORS)
  FRONTEND_URL: z.preprocess(
    (v) => (v === '' || v === null || typeof v === 'undefined' ? undefined : v),
    z.string().url().optional().default('http://localhost:3000')
  ),

  // Optional comma-separated extra origins (staging admin, mobile web, etc.)
  CORS_ORIGINS: z.string().optional().default(''),

  // Wave 6 fix: `val !== 'false'` treats *any* unset/blank value as enabled
  // (`undefined !== 'false'` is `true`), the opposite of `.env.example`'s
  // documented `REDIS_ENABLED=false` / `MQTT_ENABLED=false` defaults. A
  // deploy that forgot to set these would silently try to connect to Redis/
  // MQTT on default hosts instead of staying disabled.
  REDIS_ENABLED: z
    .string()
    .optional()
    .transform((val) => ['true', '1', 'yes', 'on'].includes((val ?? '').trim().toLowerCase())),
  REDIS_URL: optionalEnvUrl(),

  // MQTT (for manufacturing sensors)
  MQTT_ENABLED: z
    .string()
    .optional()
    .transform((val) => ['true', '1', 'yes', 'on'].includes((val ?? '').trim().toLowerCase())),
  MQTT_URL: optionalEnvUrl(),
  MQTT_USERNAME: z.string().optional(),
  MQTT_PASSWORD: z.string().optional(),

  // Tax Signature (for electronic invoices)
  TAX_PRIVATE_KEY: z.string().optional(),
  TAX_PUBLIC_KEY: z.string().optional(),
  TAX_AUTHORITY_URL: optionalEnvUrl(),

  // Replica Database (optional, for read replicas)
  REPLICA_DATABASE_URL: optionalEnvUrl(),

  // Backup and Export paths
  BACKUP_PATH: z.string().optional().default('./backups'),
  EXPORT_PATH: z.string().optional().default('./exports'),

  /**
   * L4 fix (Item 41): outbound SMTP for `emailService` (report delivery, etc.).
   * Optional — when SMTP_HOST is unset, `emailService.isEmailConfigured()`
   * returns false and sends are logged (not silently claimed as sent).
   */
  SMTP_HOST: z.preprocess(
    (v) => (v === '' || v === null || typeof v === 'undefined' ? undefined : v),
    z.string().optional()
  ),
  SMTP_PORT: z.string().optional().default('587').transform(Number),
  SMTP_SECURE: z.preprocess((v) => {
    if (v === '' || v === null || typeof v === 'undefined') return false;
    const s = String(v).trim().toLowerCase();
    return ['true', '1', 'yes', 'on'].includes(s);
  }, z.boolean()),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  SMTP_FROM: z.string().optional(),

  // Wave 6 fix: these were all read straight off `process.env` at their call
  // sites with no schema entry, no startup validation, and no single place
  // documenting what exists — a typo'd flag name silently did nothing
  // instead of failing to boot. Declaring them here doesn't change how the
  // call sites read them (still raw `process.env.X`, left as-is to avoid
  // touching ~20 files in one pass), but it does make `envSchema.parse`
  // reject malformed values for all of them at startup, and gives every
  // future reader one place to see the full set of vars this app consumes.
  API_RATE_LIMIT_MAX: z.string().optional(),
  LOG_LEVEL: z.string().optional().default('info'),
  ENCRYPTION_KEY: optionalEnvString(),
  ENABLE_TRACING: optionalEnvBoolean(),
  CACHE_WARMING_ENABLED: optionalEnvBoolean(),
  SENTINEL_ENGINE_ENABLED: optionalEnvBoolean(),
  DEMO_HAZEM_PASSWORD: optionalEnvString(),

  // ETA e-invoicing
  ETA_SIGNING_ENABLED: optionalEnvBoolean(),
  ETA_USE_LIVE_CLIENT: optionalEnvBoolean(),
  ETA_API_BASE_URL: optionalEnvUrl(),
  ETA_API_URL: optionalEnvUrl(),
  ETA_IDENTITY_URL: optionalEnvUrl(),
  ETA_CLIENT_ID: optionalEnvString(),
  ETA_CLIENT_SECRET: optionalEnvString(),
  ETA_ACCESS_TOKEN: optionalEnvString(),
  ETA_SIGNING_PROVIDER: z.enum(['mock', 'pkcs11']).optional().default('mock'),
  ETA_PKCS11_MODULE_PATH: optionalEnvString(),
  ETA_PKCS11_SLOT: z.string().optional().default('0'),
  ETA_PKCS11_CERT_LABEL: optionalEnvString(),
  ETA_PKCS11_PIN: optionalEnvString(),
  ETA_TOKEN_PIN: optionalEnvString(),

  // Other tax-authority integrations referenced alongside ETA
  TAX_AUTHORITY: optionalEnvString(),
  FTA_API_URL: optionalEnvUrl(),
  FTA_ACCESS_TOKEN: optionalEnvString(),
  ZATCA_API_URL: optionalEnvUrl(),
  ZATCA_ACCESS_TOKEN: optionalEnvString(),

  // Document archive storage
  ARCHIVE_STORAGE_PROVIDER: z.enum(['local', 's3', 'minio', 'r2']).optional().default('local'),
  ARCHIVE_STORAGE_PATH: optionalEnvString(),
  ARCHIVE_LOCAL_ROOT: optionalEnvString(),
  ARCHIVE_S3_BUCKET: optionalEnvString(),
  ARCHIVE_S3_REGION: optionalEnvString(),
  ARCHIVE_S3_ENDPOINT: optionalEnvUrl(),
  ARCHIVE_S3_ACCESS_KEY_ID: optionalEnvString(),
  ARCHIVE_S3_SECRET_ACCESS_KEY: optionalEnvString(),
  ARCHIVE_S3_FORCE_PATH_STYLE: optionalEnvBoolean(),

  // Gates AI (OpenAI-compatible chat completions). Optional so the API still
  // boots when the key is unset; providers fail closed at call time.
  OPENAI_API_KEY: optionalEnvString(),
  OPENAI_MODEL: optionalEnvString(),
  OPENAI_BASE_URL: optionalEnvUrl(),
  /** Optional Postgres+pgvector sidecar for RAG. ERP data stays on MySQL. */
  VECTOR_DATABASE_URL: optionalEnvString(),
});

/**
 * Railway MySQL plugin exposes MYSQL_URL / MYSQLHOST, not always DATABASE_URL.
 * Hydrate before Zod parse so Prisma and the API share one connection string.
 */
function hydrateDatabaseUrlFromMysqlPlugin(): void {
  if (process.env.DATABASE_URL?.trim()) return;
  if (process.env.MYSQL_URL?.trim()) {
    process.env.DATABASE_URL = process.env.MYSQL_URL.trim();
    return;
  }
  const host = process.env.MYSQLHOST || process.env.MYSQL_HOST;
  if (!host) return;
  const user = encodeURIComponent(process.env.MYSQLUSER || process.env.MYSQL_USER || 'root');
  const pass = encodeURIComponent(process.env.MYSQLPASSWORD || process.env.MYSQL_PASSWORD || '');
  const port = process.env.MYSQLPORT || process.env.MYSQL_PORT || '3306';
  const db = process.env.MYSQLDATABASE || process.env.MYSQL_DATABASE || 'railway';
  process.env.DATABASE_URL = `mysql://${user}:${pass}@${host}:${port}/${db}`;
}

hydrateDatabaseUrlFromMysqlPlugin();

/**
 * Validated environment variables
 * Access via: import { env } from './shared/config/env';
 */
export const env = envSchema.parse(process.env);

/**
 * Type-safe environment variable access
 */
export type Env = z.infer<typeof envSchema>;

/**
 * Validate production secrets
 * Ensures critical secrets are not default values in production
 */
function validateProductionSecrets(parsed: Env): void {
  if (parsed.NODE_ENV !== 'production') {
    return; // Skip validation in non-production
  }

  const warnings: string[] = [];

  if (parsed.DATABASE_URL.includes('localhost') || parsed.DATABASE_URL.includes('127.0.0.1')) {
    warnings.push('DATABASE_URL appears to be using localhost - ensure this is correct for production');
  }

  if (warnings.length > 0) {
    // Avoid importing logger here (circular deps / ts-jest); ops should use centralized logging elsewhere
    console.warn('[env] Production secret validation warnings:', warnings);
  }

  if (!parsed.DATABASE_URL || parsed.DATABASE_URL === '') {
    throw new Error('DATABASE_URL is required in production');
  }

  // Wave 6 fix: `FRONTEND_URL` used to fall back to `http://localhost:3000`
  // whenever unset and, in production, this only ever produced a *warning*
  // — so a box that forgot to set it booted "successfully" serving CORS for
  // localhost, silently rejecting the real production frontend's origin.
  // Refusing to start is louder but correct: this is a required production
  // setting, not an optional one with a safe fallback.
  const allowRailwayPreview =
    ['true', '1', 'yes', 'on'].includes((process.env.CORS_ALLOW_RAILWAY ?? '').trim().toLowerCase());
  if (
    !allowRailwayPreview &&
    (parsed.FRONTEND_URL?.includes('localhost') || parsed.FRONTEND_URL?.includes('127.0.0.1'))
  ) {
    throw new Error(
      'FRONTEND_URL must be set to the real production frontend origin (currently unset/localhost). For a Railway preview set CORS_ALLOW_RAILWAY=true until the web URL exists.'
    );
  }

  if (!parsed.KEYCLOAK_ENABLED && !parsed.JWT_DEV_SECRET) {
    throw new Error(
      'JWT_DEV_SECRET (16+ characters) is required in production when KEYCLOAK_ENABLED=false so testers can use password login.'
    );
  }
}

validateProductionSecrets(env);

