import type { PrismaClient } from '@prisma/client';

export class MigrationCheckpointService {
  constructor(private readonly prisma: PrismaClient) {}

  async load(jobId: string, stage: string, entity: string) {
    return this.prisma.migrationCheckpoint.findUnique({
      where: { migrationJobId_stage_entity: { migrationJobId: jobId, stage, entity } },
    });
  }

  /**
   * Persists checkpoint only after `commitBatch` succeeds — cursor must reflect committed work.
   */
  async saveAfterCommittedBatch<T>(
    params: {
      jobId: string;
      stage: string;
      entity: string;
      cursorKey: string | null;
      processedCount: bigint;
      successCount: bigint;
      warningCount: bigint;
      errorCount: bigint;
    },
    commitBatch: () => Promise<T>
  ): Promise<T> {
    const result = await commitBatch();
    await this.save(params);
    return result;
  }

  async save(params: {
    jobId: string;
    stage: string;
    entity: string;
    cursorKey: string | null;
    processedCount: bigint;
    successCount: bigint;
    warningCount: bigint;
    errorCount: bigint;
  }) {
    return this.prisma.migrationCheckpoint.upsert({
      where: {
        migrationJobId_stage_entity: {
          migrationJobId: params.jobId,
          stage: params.stage,
          entity: params.entity,
        },
      },
      create: {
        migrationJobId: params.jobId,
        stage: params.stage,
        entity: params.entity,
        cursorKey: params.cursorKey,
        processedCount: params.processedCount,
        successCount: params.successCount,
        warningCount: params.warningCount,
        errorCount: params.errorCount,
      },
      update: {
        cursorKey: params.cursorKey,
        processedCount: params.processedCount,
        successCount: params.successCount,
        warningCount: params.warningCount,
        errorCount: params.errorCount,
      },
    });
  }
}
