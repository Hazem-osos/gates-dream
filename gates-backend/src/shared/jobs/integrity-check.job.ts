import { Queue, Worker } from 'bullmq';
import { logger } from '../logger';
import { env } from '../config/env';
import { integrityChecker } from '../consistency/integrity-checker';

/**
 * Scheduled Job: Data Integrity Check
 * Runs periodic data integrity checks
 */

const INTEGRITY_CHECK_QUEUE = 'integrity-check';

export const integrityCheckQueue = new Queue(INTEGRITY_CHECK_QUEUE, {
  connection: {
    host: new URL(env.REDIS_URL!).hostname,
    port: parseInt(new URL(env.REDIS_URL!).port),
  },
});

export const integrityCheckWorker = new Worker(
  INTEGRITY_CHECK_QUEUE,
  async (job) => {
    logger.info({ jobId: job.id }, 'Starting integrity check job');

    try {
      const results = await integrityChecker.runAllChecks();
      const partyDrift = results.find((r) => r.checkName === 'Party Balance Base-Currency Drift');

      const hasErrors = results.some((r) => !r.passed);
      if (partyDrift && !partyDrift.passed) {
        logger.warn(
          { jobId: job.id, errorCount: partyDrift.errorCount, errors: partyDrift.errors },
          'Party balance drift requires reconciliation'
        );
      }

      if (hasErrors) {
        logger.warn(
          {
            jobId: job.id,
            results: results.map((r) => ({
              check: r.checkName,
              errors: r.errorCount,
            })),
          },
          'Integrity check found errors'
        );
      } else {
        logger.info({ jobId: job.id }, 'All integrity checks passed');
      }

      return {
        success: true,
        results,
        timestamp: new Date().toISOString(),
      };
    } catch (error: any) {
      logger.error({ error, jobId: job.id }, 'Integrity check job failed');
      throw error;
    }
  },
  {
    connection: {
      host: new URL(env.REDIS_URL!).hostname,
      port: parseInt(new URL(env.REDIS_URL!).port),
    },
  }
);

/**
 * Schedule integrity check (run daily at 2 AM)
 */
export async function scheduleIntegrityCheck(): Promise<void> {
  if (!env.REDIS_ENABLED) {
    logger.warn('Redis not enabled, cannot schedule integrity check');
    return;
  }

  try {
    // Add recurring job (daily at 2 AM)
    await integrityCheckQueue.add(
      'daily-integrity-check',
      {},
      {
        repeat: {
          pattern: '0 2 * * *', // Cron: Daily at 2 AM
        },
        removeOnComplete: true,
        removeOnFail: false,
      }
    );

    logger.info('Integrity check scheduled (daily at 2 AM)');
  } catch (error: any) {
    logger.error({ error }, 'Failed to schedule integrity check');
  }
}

// Start worker
if (env.REDIS_ENABLED) {
  integrityCheckWorker.on('completed', (job) => {
    logger.info({ jobId: job.id }, 'Integrity check job completed');
  });

  integrityCheckWorker.on('failed', (job, err) => {
    logger.error({ jobId: job?.id, error: err }, 'Integrity check job failed');
  });
}

