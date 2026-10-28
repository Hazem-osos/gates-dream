import type { JobsOptions } from 'bullmq';
import { getQueue } from '../queue-manager';
import { logger } from '../../shared/logger';

export const MIGRATION_RUN_QUEUE = 'migration-run';

export type MigrationRunJobData = {
  companyId: string;
  migrationJobId: string;
  mode: 'analyze' | 'dry-run' | 'execute' | 'reconcile' | 'auto';
  stages?: string[];
};

export function getMigrationRunQueue() {
  return getQueue<MigrationRunJobData>(MIGRATION_RUN_QUEUE);
}

export async function findQueuedMigrationRun(migrationJobId: string) {
  const queue = getMigrationRunQueue();
  const states = ['active', 'waiting', 'delayed', 'paused'] as const;
  for (const state of states) {
    const jobs = await queue.getJobs(state, 0, 200);
    const hit = jobs.find((j) => j.data?.migrationJobId === migrationJobId);
    if (hit) return hit;
  }
  return null;
}

export async function abortQueuedMigrationRuns(migrationJobId: string): Promise<number> {
  const queue = getMigrationRunQueue();
  const states = ['active', 'waiting', 'delayed', 'paused'] as const;
  let aborted = 0;
  for (const state of states) {
    const jobs = await queue.getJobs(state, 0, 200);
    for (const job of jobs) {
      if (job.data?.migrationJobId !== migrationJobId) continue;
      try {
        if (state === 'active' && job.token) {
          await job.moveToFailed(new Error('Aborted by user'), job.token, false);
        } else {
          await job.remove();
        }
        aborted += 1;
      } catch (err) {
        logger.warn({ migrationJobId, bullJobId: job.id, err }, 'Could not remove migration run job');
        try {
          await job.discard();
          aborted += 1;
        } catch {
          /* still running until the worker sees cancel */
        }
      }
    }
  }
  return aborted;
}

export async function enqueueMigrationRun(data: MigrationRunJobData, options: JobsOptions = {}) {
  const queue = getMigrationRunQueue();
  const existing = await findQueuedMigrationRun(data.migrationJobId);
  if (existing) {
    return existing;
  }
  const job = await queue.add(`migration-${data.mode}`, data, {
    attempts: 3,
    backoff: { type: 'exponential', delay: 15_000 },
    removeOnComplete: { age: 604_800, count: 200 },
    removeOnFail: { age: 604_800 },
    ...options,
  });
  logger.info(
    { queue: MIGRATION_RUN_QUEUE, migrationJobId: data.migrationJobId, mode: data.mode, jobId: job.id },
    'Migration run enqueued'
  );
  return job;
}
