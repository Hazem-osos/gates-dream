import type { MigrationJobService } from './migration-job.service';
import { migrationProgressFlushMs } from '../migration-engine-config';

type PendingPatch = Record<string, unknown>;

/**
 * Coalesces frequent progress patches to reduce DB write pressure on large jobs.
 * Committed counters should be passed via `committed` and are flushed immediately.
 */
export class MigrationProgressThrottle {
  private pending: PendingPatch = {};
  private lastFlush = Date.now();
  private timer: ReturnType<typeof setTimeout> | null = null;

  constructor(
    private readonly jobId: string,
    private readonly jobs: MigrationJobService,
    private readonly flushMs = migrationProgressFlushMs()
  ) {}

  async patch(patch: PendingPatch, opts?: { immediate?: boolean }) {
    this.pending = { ...this.pending, ...patch };
    if (opts?.immediate || patch.committed != null) {
      await this.flush();
      return;
    }
    const now = Date.now();
    if (now - this.lastFlush >= this.flushMs) {
      await this.flush();
      return;
    }
    if (!this.timer) {
      this.timer = setTimeout(() => {
        this.timer = null;
        void this.flush().catch(() => undefined);
      }, this.flushMs);
    }
  }

  async flush() {
    if (!Object.keys(this.pending).length) return;
    const body = this.pending;
    this.pending = {};
    this.lastFlush = Date.now();
    await this.jobs.mergeProgress(this.jobId, body);
  }

  dispose() {
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
  }
}
