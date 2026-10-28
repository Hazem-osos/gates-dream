import { randomUUID } from 'node:crypto';
import type { PrismaClient } from '@prisma/client';
import { MigrationJobService } from './migration-job.service';
import { MigrationProgressThrottle } from './migration-progress-throttle.service';
import { migrationJobLockHeartbeatMs, migrationJobLockTtlMs } from '../migration-engine-config';
import { isMigrationAborted, isMigrationPausedAtCheckpoint } from '../migration-cooperative-pause';
import { MigrationStateMachineError } from '../state-machine';

export class MigrationJobRunCoordinator {
  private readonly jobs: MigrationJobService;
  private token: string | null = null;
  private heartbeat: ReturnType<typeof setInterval> | null = null;
  private progress: MigrationProgressThrottle | null = null;

  constructor(private readonly prisma: PrismaClient) {
    this.jobs = new MigrationJobService(prisma);
  }

  get jobService() {
    return this.jobs;
  }

  progressWriter(jobId: string) {
    if (!this.progress) this.progress = new MigrationProgressThrottle(jobId, this.jobs);
    return this.progress;
  }

  async beginRun(migrationJobId: string): Promise<boolean> {
    this.token = randomUUID();
    const locked = await this.jobs.acquireLock(migrationJobId, this.token, migrationJobLockTtlMs());
    if (!locked) return false;

    const hbMs = migrationJobLockHeartbeatMs();
    this.heartbeat = setInterval(() => {
      if (!this.token) return;
      void this.jobs.extendLock(migrationJobId, this.token, migrationJobLockTtlMs()).catch(() => undefined);
    }, hbMs);

    await this.jobs.mergeProgress(migrationJobId, {
      run: { workerStartedAt: new Date().toISOString(), lockTokenHint: this.token.slice(0, 8) },
      ui: { lastError: null, lastFailedAt: null, workerStartedAt: new Date().toISOString() },
    });
    return true;
  }

  async endRun(migrationJobId: string, err?: unknown) {
    if (this.heartbeat) clearInterval(this.heartbeat);
    this.heartbeat = null;
    await this.progress?.flush().catch(() => undefined);
    this.progress?.dispose();
    this.progress = null;

    if (this.token) {
      await this.jobs.releaseLock(migrationJobId, this.token);
      this.token = null;
    }

    if (err == null) return;

    if (isMigrationAborted(err) || /aborted by user|Migration job aborted/i.test(String(err))) {
      const job = await this.jobs.getJob(migrationJobId);
      if (job && job.status !== 'FAILED') {
        await this.jobs.transition(migrationJobId, 'FAILED').catch((e) => {
          if (!(e instanceof MigrationStateMachineError)) throw e;
        });
      }
      return;
    }

    if (isMigrationPausedAtCheckpoint(err)) {
      const job = await this.jobs.getJob(migrationJobId);
      if (job?.status !== 'PAUSED') {
        await this.jobs.transition(migrationJobId, 'PAUSED').catch((e) => {
          if (!(e instanceof MigrationStateMachineError)) throw e;
        });
      }
      return;
    }

    const lastError = err instanceof Error ? err.message : String(err);
    await this.jobs.mergeProgress(migrationJobId, {
      ui: { lastError, lastFailedAt: new Date().toISOString() },
    });

    const job = await this.jobs.getJob(migrationJobId);
    if (job && !['PAUSED', 'FAILED', 'BLOCKED', 'COMPLETED'].includes(job.status)) {
      await this.jobs.transition(migrationJobId, 'FAILED').catch((e) => {
        if (!(e instanceof MigrationStateMachineError)) throw e;
      });
    }
  }
}
