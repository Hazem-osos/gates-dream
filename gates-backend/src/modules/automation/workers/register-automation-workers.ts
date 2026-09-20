import type { Worker } from 'bullmq';
import { logger } from '../../../shared/logger';
import { env } from '../../../shared/config/env';
import { automationQueues } from '../queues/automation.queues';
import { createChequeBouncedWorker } from '../processors/cheque-bounced.processor';
import { createAutomationSchedulersWorker } from '../processors/scheduler.worker';
import { createSubcontractInvoiceWorkflowWorker } from '../processors/subcontract-invoice-workflow.processor';
import { createUnitCancellationReleasedWorker } from '../processors/unit-cancellation-released.processor';
import { createAutomationEventDispatchWorker } from '../events/automation-event-dispatch.worker';

const registeredWorkers: Worker[] = [];
let shutdownHookInstalled = false;

export function registerAutomationWorkers(): Worker[] {
  if (!env.REDIS_ENABLED) {
    logger.warn('Redis disabled — automation workers were not started');
    return [];
  }
  if (registeredWorkers.length > 0) return registeredWorkers;

  registeredWorkers.push(
    createAutomationSchedulersWorker(),
    createChequeBouncedWorker(),
    createSubcontractInvoiceWorkflowWorker(),
    createUnitCancellationReleasedWorker(),
    createAutomationEventDispatchWorker()
  );

  logger.info({ count: registeredWorkers.length }, 'Automation workers started');
  return registeredWorkers;
}

export async function closeAutomationWorkers(): Promise<void> {
  if (registeredWorkers.length === 0) return;
  await Promise.allSettled(registeredWorkers.map((worker) => worker.close()));
  registeredWorkers.splice(0, registeredWorkers.length);
  logger.info('Automation workers closed');
}

export async function closeAutomationQueues(): Promise<void> {
  await Promise.allSettled(automationQueues.map((queue) => queue.close()));
  logger.info('Automation queues closed');
}

export function installAutomationShutdownHooks(): void {
  if (shutdownHookInstalled) return;
  shutdownHookInstalled = true;

  const shutdown = async (signal: string) => {
    logger.info({ signal }, 'Closing automation workers');
    await closeAutomationWorkers();
  };

  process.once('SIGTERM', () => {
    void shutdown('SIGTERM');
  });
  process.once('SIGINT', () => {
    void shutdown('SIGINT');
  });
}
