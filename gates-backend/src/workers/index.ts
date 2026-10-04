import '../shared/format/english-digits';
import http from 'http';
import path from 'path';
import { fileURLToPath } from 'url';
import { logger } from '../shared/logger';
import { AUTOMATION_QUEUE_NAMES } from '../modules/automation';
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
    void import('../modules/ereceipt/worker')
      .then(({ registerEreceiptWorker }) => registerEreceiptWorker())
      .catch((error) => logger.error({ error }, 'Failed to register eReceipt worker'));
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
    import('../modules/ereceipt/worker').then(({ closeEreceiptWorker }) => closeEreceiptWorker()),
    closeQueueManager(),
    closeBullmqRedisPool(),
  ]);
  process.exit(0);
}

const isDirectRun =
  typeof process.argv[1] === 'string' &&
  fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);

function startWorkerHealthServer(): http.Server {
  const port = Number(process.env.PORT || 3001);
  const server = http.createServer((req, res) => {
    const pathOnly = (req.url || '/').split('?')[0];
    if (pathOnly === '/health/live' || pathOnly === '/health') {
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ status: 'ok', role: 'worker' }));
      return;
    }
    res.writeHead(404);
    res.end();
  });
  server.listen(port, '0.0.0.0', () => {
    logger.info({ port, queue: AUTOMATION_QUEUE_NAMES.domainEvents }, 'Worker health server listening');
  });
  return server;
}

if (isDirectRun || process.env.GATES_RUN_WORKERS === '1') {
  const healthServer = startWorkerHealthServer();
  initializeWorkers();

  process.on('SIGTERM', () => {
    healthServer.close();
    void shutdownWorkers('SIGTERM');
  });
  process.on('SIGINT', () => {
    healthServer.close();
    void shutdownWorkers('SIGINT');
  });
}

export { initializeWorkers };
