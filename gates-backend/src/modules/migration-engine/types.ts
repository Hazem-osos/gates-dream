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
  | 'INVENTORY'
  | 'COMMERCIAL';

export interface MigrationEngineOptions {
  legacyCompanyCode: string;
  batchSize?: number;
}

export interface SourceBatch<T = Record<string, unknown>> {
  rows: T[];
  nextCursor: string | null;
}

export interface LegacySourceAdapter {
  testConnection(): Promise<void>;
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
  close(): Promise<void>;
}

export interface MigrationWriteResult {
  outcome: MigrationIdOutcome;
  targetId?: string;
  simulated?: boolean;
}

export interface StageRunReport {
  stage: MigrationStageName;
  sourceCounts: Record<string, number>;
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
