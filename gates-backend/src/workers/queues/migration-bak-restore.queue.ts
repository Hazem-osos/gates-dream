import { Queue } from 'bullmq';
import { workerRedisConnection, isRedisEnabledFlag } from '../redis-connection';

export const MIGRATION_BAK_RESTORE_QUEUE = 'migration-bak-restore';

export type MigrationBakRestoreJobData = {
  restoreRunId: string;
  companyId: string;
  packageId: string;
};

let queue: Queue<MigrationBakRestoreJobData> | null = null;

export function getMigrationBakRestoreQueue(): Queue<MigrationBakRestoreJobData> | null {
  if (!isRedisEnabledFlag()) return null;
  if (!queue) {
    queue = new Queue<MigrationBakRestoreJobData>(MIGRATION_BAK_RESTORE_QUEUE, {
      connection: workerRedisConnection,
    });
  }
  return queue;
}

export async function enqueueMigrationBakRestore(data: MigrationBakRestoreJobData) {
  const q = getMigrationBakRestoreQueue();
  if (!q) return null;
  return q.add('restore', data, {
    jobId: `bak-restore-${data.restoreRunId}`,
    attempts: 8,
    backoff: { type: 'fixed', delay: 20_000 },
    removeOnComplete: 100,
    removeOnFail: 200,
  });
}
