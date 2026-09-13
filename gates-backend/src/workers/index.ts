import path from 'path';
import { fileURLToPath } from 'url';
import { logger } from '../shared/logger';
import {
  closeAutomationWorkers,
  registerAutomationWorkers,
  scheduleAutomationJobs,
} from '../modules/automation';
import { payrollWorker } from './processors/payroll.processor';
import { reportsWorker } from './processors/reports.processor';
import { createPdfGenerationWorker } from './processors/pdf-generation.processor';
import { createTaxPortalSyncWorker } from './processors/tax-portal-sync.processor';
import { createReportExportWorker } from './processors/report-export.processor';
import { closeQueueManager } from './queue-manager';
import { closeBullmqRedisPool } from './redis-pool';

const pdfGenerationWorker = createPdfGenerationWorker();
const taxPortalSyncWorker = createTaxPortalSyncWorker();
const reportExportWorker = createReportExportWorker();

/**
 * Initialize all workers
 * This file should be run as a separate process (`npm run start:workers`)
 */
const initializeWorkers = () => {
  try {
    registerAutomationWorkers();
    void scheduleAutomationJobs().catch((error) => {
      logger.error({ error }, 'Failed to register automation cron jobs');
    });
    void import('../modules/ai/proactive/proactive.queue')
      .then(({ scheduleProactiveCfoJob, startProactiveCfoWorker }) => {
        startProactiveCfoWorker();
        return scheduleProactiveCfoJob();
      })
      .catch((error) => {
        logger.error({ error }, 'Failed to register proactive CFO job');
      });

    logger.info(
      {
        queues: ['pdf-generation', 'tax-portal-sync', 'report-export', 'payroll', 'reports'],
      },
      'All workers started'
    );
  } catch (error) {
    logger.error({ error }, 'Error starting workers');
    process.exit(1);
  }
};

async function shutdownWorkers(signal: string): Promise<void> {
  logger.info({ signal }, 'Shutting down workers');
  await Promise.allSettled([
    payrollWorker.close(),
    reportsWorker.close(),
    pdfGenerationWorker.close(),
    taxPortalSyncWorker.close(),
    reportExportWorker.close(),
    closeAutomationWorkers(),
    closeQueueManager(),
    closeBullmqRedisPool(),
  ]);
  process.exit(0);
}

const isDirectRun =
  typeof process.argv[1] === 'string' &&
  fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);

if (isDirectRun || process.env.GATES_RUN_WORKERS === '1') {
  initializeWorkers();

  process.on('SIGTERM', () => {
    void shutdownWorkers('SIGTERM');
  });
  process.on('SIGINT', () => {
    void shutdownWorkers('SIGINT');
  });
}

export { initializeWorkers };
