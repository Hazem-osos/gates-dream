import type { PrismaClient } from '@prisma/client';
import type { LegacySourceAdapter, MigrationEngineOptions } from './types';
import type { MigrationJobService } from './services/migration-job.service';
import type { MigrationIdMapService } from './services/migration-id-map.service';
import type { MigrationCheckpointService } from './services/migration-checkpoint.service';
import type { MigrationIssueService } from './services/migration-issue.service';

export class MigrationContextError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'MigrationContextError';
  }
}

export interface MigrationContextDeps {
  prisma: PrismaClient;
  jobService: MigrationJobService;
  idMapService: MigrationIdMapService;
  checkpointService: MigrationCheckpointService;
  issueService: MigrationIssueService;
  sourceAdapter: LegacySourceAdapter;
}

export class MigrationContext {
  readonly migrationJobId: string;
  readonly targetCompanyId: string;
  readonly legacyCompanyCode: string;
  readonly sourceFingerprint: string;
  readonly dryRun: boolean;
  readonly options: MigrationEngineOptions;

  constructor(
    params: {
      migrationJobId: string;
      targetCompanyId: string;
      legacyCompanyCode: string;
      sourceFingerprint: string;
      dryRun: boolean;
      options: MigrationEngineOptions;
    },
    private readonly deps: MigrationContextDeps
  ) {
    if (!params.targetCompanyId?.trim()) {
      throw new MigrationContextError('targetCompanyId is required — no default company.');
    }
    if (!params.legacyCompanyCode?.trim()) {
      throw new MigrationContextError('legacyCompanyCode is required.');
    }
    this.migrationJobId = params.migrationJobId;
    this.targetCompanyId = params.targetCompanyId;
    this.legacyCompanyCode = params.legacyCompanyCode;
    this.sourceFingerprint = params.sourceFingerprint;
    this.dryRun = params.dryRun;
    this.options = params.options;
  }

  get prisma() {
    return this.deps.prisma;
  }

  get source() {
    return this.deps.sourceAdapter;
  }

  get jobs() {
    return this.deps.jobService;
  }

  get idMap() {
    return this.deps.idMapService;
  }

  get checkpoints() {
    return this.deps.checkpointService;
  }

  get issues() {
    return this.deps.issueService;
  }

  log(message: string, meta?: Record<string, unknown>) {
    const safe = { jobId: this.migrationJobId, stage: meta?.stage, entity: meta?.entity };
    console.log('[migration]', message, safe);
  }
}
