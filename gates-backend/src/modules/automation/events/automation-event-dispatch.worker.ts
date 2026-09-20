/**
 * Delivers one AutomationEventEnvelope to n8n's "Universal Event Intake"
 * webhook (N8N_EVENT_INTAKE_URL). This is the only outbound HTTP call GATES
 * makes to n8n for the rule engine's WHEN side.
 *
 * If N8N_EVENT_INTAKE_URL is unset, the job completes as a documented no-op
 * (logged) instead of failing forever — the platform operator has simply
 * not connected an n8n environment yet, which is a valid, safe state.
 *
 * On a genuine delivery failure (network/non-2xx), the job throws so BullMQ
 * retries it with the shared DEFAULT_AUTOMATION_JOB_OPTIONS backoff — this
 * is where the "n8n retry" boundary lives on the GATES side; n8n's OWN
 * internal retry policy inside its workflow is a separate, external concern.
 */
import { Worker, type Job } from 'bullmq';
import { logger } from '../../../shared/logger';
import { env } from '../../../shared/config/env';
import { workerRedisConnection } from '../../../workers/redis-connection';
import { AUTOMATION_QUEUE_NAMES } from '../types/automation-jobs.types';
import type { DispatchAutomationDomainEventJobData } from '../types/automation-jobs.types';

const DELIVERY_TIMEOUT_MS = 10_000;

export async function processDispatchDomainEventJob(
  job: Job<DispatchAutomationDomainEventJobData>
): Promise<{ delivered: boolean }> {
  const { companyId, eventId, eventType } = job.data;

  if (!env.N8N_EVENT_INTAKE_URL) {
    logger.info(
      { companyId, eventId, eventType },
      'N8N_EVENT_INTAKE_URL not configured — automation event was not delivered (no-op)'
    );
    return { delivered: false };
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), DELIVERY_TIMEOUT_MS);
  try {
    const response = await fetch(env.N8N_EVENT_INTAKE_URL, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        ...(env.AUTOMATION_INTERNAL_API_KEY ? { 'x-api-key': env.AUTOMATION_INTERNAL_API_KEY } : {}),
      },
      body: JSON.stringify(job.data),
      signal: controller.signal,
    });
    if (!response.ok) {
      throw new Error(`n8n event intake responded ${response.status}`);
    }
    logger.info({ companyId, eventId, eventType }, 'Automation domain event delivered to n8n');
    return { delivered: true };
  } finally {
    clearTimeout(timer);
  }
}

export function createAutomationEventDispatchWorker(): Worker<DispatchAutomationDomainEventJobData> {
  const worker = new Worker<DispatchAutomationDomainEventJobData>(
    AUTOMATION_QUEUE_NAMES.domainEvents,
    processDispatchDomainEventJob,
    { connection: workerRedisConnection }
  );
  worker.on('failed', (job, err) => {
    logger.error(
      { jobId: job?.id, eventId: job?.data?.eventId, error: err },
      'AutomationEventDispatchWorker failed'
    );
  });
  return worker;
}
