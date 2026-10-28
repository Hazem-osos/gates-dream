import type { MigrationContext } from './migration-context';
import type { MigrationJobStatus } from './state-machine';

/** Thrown when a job was paused cooperatively at a batch checkpoint. */
export class MigrationPausedAtCheckpoint extends Error {
  constructor(
    readonly jobId: string,
    readonly stage?: string,
    readonly entity?: string
  ) {
    super(`Migration job ${jobId} paused at checkpoint${stage ? ` (${stage}/${entity ?? ''})` : ''}`);
    this.name = 'MigrationPausedAtCheckpoint';
  }
}

/** Thrown when the user aborts a run so they can analyze / dry-run again. */
export class MigrationAbortedError extends Error {
  constructor(
    readonly jobId: string,
    readonly stage?: string,
    readonly entity?: string
  ) {
    super(`Migration job ${jobId} aborted${stage ? ` (${stage}/${entity ?? ''})` : ''}`);
    this.name = 'MigrationAbortedError';
  }
}

export async function throwIfMigrationPaused(
  ctx: MigrationContext,
  meta?: { stage?: string; entity?: string }
): Promise<void> {
  const job = await ctx.jobs.getJob(ctx.migrationJobId);
  if (await ctx.jobs.isCancelRequested(ctx.migrationJobId) || job?.status === 'FAILED') {
    throw new MigrationAbortedError(ctx.migrationJobId, meta?.stage, meta?.entity);
  }
  if (job?.status === 'PAUSED') {
    throw new MigrationPausedAtCheckpoint(ctx.migrationJobId, meta?.stage, meta?.entity);
  }
}

export function isMigrationPausedAtCheckpoint(err: unknown): err is MigrationPausedAtCheckpoint {
  return err instanceof MigrationPausedAtCheckpoint;
}

export function isMigrationAborted(err: unknown): err is MigrationAbortedError {
  return err instanceof MigrationAbortedError || (err instanceof Error && err.name === 'MigrationAbortedError');
}

export async function handleMigrationStageError(
  jobs: { transition: (id: string, status: MigrationJobStatus) => Promise<unknown> },
  jobId: string,
  err: unknown
): Promise<void> {
  if (isMigrationPausedAtCheckpoint(err)) {
    await jobs.transition(jobId, 'PAUSED').catch(() => undefined);
    return;
  }
  if (isMigrationAborted(err)) {
    await jobs.transition(jobId, 'FAILED').catch(() => undefined);
    return;
  }
  const paused = String(err).includes('MIGRATION_TEST_SIMULATED_FAILURE');
  await jobs.transition(jobId, paused ? 'PAUSED' : 'FAILED').catch(() => undefined);
}
