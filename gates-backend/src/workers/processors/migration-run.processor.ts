import { Worker, type Job } from 'bullmq';
import { logger } from '../../shared/logger';
import { workerRedisConnection } from '../redis-connection';
import prisma from '../../shared/database/prisma';
import { MIGRATION_RUN_QUEUE, type MigrationRunJobData } from '../queues/migration-run.queue';
import { MigrationPipelineService } from '../../modules/migration-engine/services/migration-pipeline.service';
import { MigrationOrchestratorService } from '../../modules/migration-engine/services/migration-orchestrator.service';
import type { MigrationPipelineStageId } from '../../modules/migration-engine/services/migration-pipeline.service';
import { MigrationJobRunCoordinator } from '../../modules/migration-engine/services/migration-job-run-coordinator';

async function processMigrationRun(job: Job<MigrationRunJobData>) {
  const { migrationJobId, mode, stages, companyId } = job.data;
  const pipeline = new MigrationPipelineService(prisma);
  const coordinator = new MigrationJobRunCoordinator(prisma);
  const jobs = coordinator.jobService;

  logger.info({ migrationJobId, mode, bullJobId: job.id }, 'Migration worker started');

  const migrationJob = await jobs.getJob(migrationJobId);
  if (!migrationJob || migrationJob.targetCompanyId !== companyId) {
    throw new Error(`Migration job ${migrationJobId} not found or company mismatch`);
  }

  const locked = await coordinator.beginRun(migrationJobId);
  if (!locked) {
    logger.warn({ migrationJobId }, 'Migration worker skipped — job lock held by another runner');
    throw new Error(`Migration job ${migrationJobId} is already running`);
  }

  try {
    if (mode === 'analyze') {
      const result = await pipeline.analyze(migrationJobId);
      await jobs.mergeProgress(migrationJobId, { lastAnalyze: result });
      return result;
    }

    if (mode === 'reconcile') {
      return new MigrationOrchestratorService(prisma).runFullReconciliation(migrationJobId);
    }

    const stageList = stages as MigrationPipelineStageId[] | undefined;
    if (mode === 'dry-run') {
      return await pipeline.runPipeline(migrationJobId, 'dry-run', stageList);
    }

    if (mode === 'auto') {
      const terminal = (status?: string) =>
        status === 'BLOCKED' || status === 'FAILED' || status === 'PAUSED';

      let current = await jobs.getJob(migrationJobId);
      let analyzeResult: unknown;
      if (
        current &&
        (current.status === 'DRAFT' || current.status === 'FAILED' || current.status === 'ANALYZING')
      ) {
        analyzeResult = await pipeline.analyze(migrationJobId);
        await jobs.mergeProgress(migrationJobId, { lastAnalyze: analyzeResult, pipelineMode: 'auto' });
        current = await jobs.getJob(migrationJobId);
        if (terminal(current?.status)) {
          return { analyze: analyzeResult, stopped: current?.status };
        }
      }

      if (
        current &&
        (current.status === 'READY_FOR_DRY_RUN' || current.status === 'DRY_RUNNING')
      ) {
        const dryRun = await pipeline.runPipeline(migrationJobId, 'dry-run', stageList);
        current = await jobs.getJob(migrationJobId);
        if (terminal(current?.status)) {
          return { analyze: analyzeResult, dryRun, stopped: current?.status };
        }
      }

      return await pipeline.runPipeline(migrationJobId, 'execute', stageList);
    }

    return await pipeline.runPipeline(migrationJobId, 'execute', stageList);
  } catch (err) {
    await coordinator.endRun(migrationJobId, err);
    throw err;
  } finally {
    await coordinator.endRun(migrationJobId);
  }
}

export function createMigrationRunWorker(): Worker<MigrationRunJobData> {
  const worker = new Worker<MigrationRunJobData>(MIGRATION_RUN_QUEUE, processMigrationRun, {
    connection: workerRedisConnection,
    concurrency: 1,
  });

  worker.on('completed', (job) => {
    logger.info({ migrationJobId: job.data.migrationJobId, mode: job.data.mode }, 'Migration worker completed');
  });

  worker.on('failed', (job, err) => {
    logger.error(
      { migrationJobId: job?.data.migrationJobId, err },
      'Migration worker failed'
    );
  });

  return worker;
}

/** Started from API process when workers are not deployed (local dev fallback). */
export async function runMigrationRunInline(data: MigrationRunJobData) {
  return processMigrationRun({ data, id: 'inline' } as Job<MigrationRunJobData>);
}
