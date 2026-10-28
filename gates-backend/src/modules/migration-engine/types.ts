export const MIGRATION_JOB_STATUSES = [
  'DRAFT',
  'ANALYZING',
  'READY_FOR_DRY_RUN',
  'DRY_RUNNING',
  'BLOCKED',
  'READY',
  'RUNNING',
  'PAUSED',
  'FAILED',
  'RECONCILING',
  'COMPLETED',
  'ROLLED_BACK',
] as const;

export type MigrationJobStatus = (typeof MIGRATION_JOB_STATUSES)[number];

export const MIGRATION_ISSUE_SEVERITIES = ['INFO', 'WARNING', 'ERROR', 'BLOCKER'] as const;
export type MigrationIssueSeverity = (typeof MIGRATION_ISSUE_SEVERITIES)[number];

export const MIGRATION_ID_OUTCOMES = [
  'CREATED_BY_MIGRATION',
  'ALREADY_MAPPED',
  'NATIVE_TARGET_CONFLICT',
  'SOURCE_CHANGED',
  'BLOCKED',
  'SIMULATED',
  'OWNER_APPROVED_MAPPING',
] as const;

export const GL_POSTED_ACCOUNT_RESOLUTIONS = [
  'EXACT_MASTER',
  'DERIVED_SAFE',
  'PARTY_RESOLVED',
  'OWNER_APPROVED_MAPPING',
] as const;

export type GlPostedAccountResolution = (typeof GL_POSTED_ACCOUNT_RESOLUTIONS)[number];

export type MigrationIdOutcome = (typeof MIGRATION_ID_OUTCOMES)[number];

export type MigrationStageName =
  | 'FOUNDATION'
  | 'COA'
  | 'PARTIES'
  | 'ACCOUNTING'
  | 'ITEMS'
  | 'INVENTORY'
  | 'COMMERCIAL'
  | 'TREASURY_HISTORICAL'
  | 'SETTLEMENT_HISTORICAL'
  | 'CHEQUE_HISTORICAL';

export interface MigrationEngineOptions {
  legacyCompanyCode: string;
  batchSize?: number;
}

export interface SourceBatch<T = Record<string, unknown>> {
  rows: T[];
  nextCursor: string | null;
}

export const LEGACY_SOURCE_MODES = [
  'REMOTE_SQL_SERVER',
  'ON_PREMISE_CONNECTOR',
  'BACKUP_RESTORE',
] as const;

export type LegacySourceMode = (typeof LEGACY_SOURCE_MODES)[number];

export interface LegacySchemaTable {
  name: string;
  columnCount: number;
}

export interface LegacySourceHealth {
  ok: boolean;
  mode: LegacySourceMode;
  message?: string;
  latencyMs?: number;
}

export interface LegacySourceAdapter {
  mode(): LegacySourceMode;
  connect(): Promise<void>;
  testConnection(): Promise<void>;
  discoverSchema(): Promise<LegacySchemaTable[]>;
  reportHealth(): Promise<LegacySourceHealth>;
  getFingerprint(legacyCompanyCode: string): Promise<string>;
  getDatabaseName(): Promise<string>;
  count(table: string, legacyCompanyCode: string): Promise<number>;
  queryBatch(
    table: string,
    legacyCompanyCode: string,
    cursor: string | null,
    limit: number
  ): Promise<SourceBatch>;
  querySql<T = Record<string, unknown>>(sql: string, params?: Record<string, unknown>): Promise<T[]>;
  streamRows(
    table: string,
    legacyCompanyCode: string,
    onBatch: (batch: SourceBatch) => Promise<void> | void,
    options?: { batchSize?: number; maxRows?: number }
  ): Promise<void>;
  close(): Promise<void>;
}

export function normalizeLegacySourceMode(input?: string | null): LegacySourceMode {
  const v = (input ?? '').trim().toUpperCase();
  if (v === 'LEGACY_CONNECTION' || v === 'REMOTE' || v === 'REMOTE_SQL_SERVER') {
    return 'REMOTE_SQL_SERVER';
  }
  if (v === 'PACKAGE' || v === 'BACKUP' || v === 'BACKUP_RESTORE') {
    return 'BACKUP_RESTORE';
  }
  if (v === 'CONNECTOR' || v === 'ON_PREMISE' || v === 'ON_PREMISE_CONNECTOR') {
    return 'ON_PREMISE_CONNECTOR';
  }
  return 'REMOTE_SQL_SERVER';
}

/** Provisional fingerprint for package-only jobs before SQL is bound. */
export function packageProvisionalFingerprint(sha256: string): string {
  return `package:${sha256.slice(0, 64)}`;
}

/** Provisional fingerprint until the Windows agent answers analyze. */
export function connectorProvisionalFingerprint(configId: string): string {
  return `connector:${configId}`;
}

export function isProvisionalPackageFingerprint(fp: string): boolean {
  const v = (fp ?? '').trim();
  return v.startsWith('package:') || v.startsWith('connector:') || v === 'pending';
}

export interface MigrationWriteResult {
  outcome: MigrationIdOutcome;
  targetId?: string;
  simulated?: boolean;
}

export interface StageRunReport {
  stage: MigrationStageName;
  sourceCounts: Record<string, number | string>;
  transformed: number;
  written: number;
  simulated: number;
  warnings: number;
  errors: number;
  blockers: number;
}

export interface ReconciliationBaseline {
  postedJournalHeaders: number;
  baseDebit: string;
  baseCredit: string;
  difference: string;
  unbalancedPostedJournals: number;
}
