/**
 * Safe event emission (Task 3). Public entrypoint real GATES domain
 * services call AFTER their own operation has genuinely succeeded.
 *
 * This function NEVER throws — the whole point is that automation is
 * optional and must never corrupt/roll back a successful ERP operation.
 * Delivery is fully async: this only enqueues a BullMQ job (local Redis),
 * decoupling ERP correctness from n8n's availability entirely. The actual
 * HTTP call to n8n happens in the worker (automation-event-dispatch.worker.ts)
 * with BullMQ's own attempts/backoff for transient delivery failures.
 */
import { randomUUID } from 'crypto';
import { logger } from '../../../shared/logger';
import { enqueueDomainEventDispatchJob } from '../producers/domain-event.producer';
import { getEventDefinition } from '../catalog/event-catalog';
import type { EmitDomainEventInput } from './automation-event.types';

export async function emitDomainEvent(input: EmitDomainEventInput): Promise<void> {
  try {
    const definition = getEventDefinition(input.eventType);
    if (!definition) {
      logger.warn(
        { eventType: input.eventType },
        'emitDomainEvent called with an eventType not present in EVENT_CATALOG — emitting anyway, but add it to the catalog'
      );
    }

    const eventId = input.eventId ?? randomUUID();
    await enqueueDomainEventDispatchJob({
      companyId: input.companyId,
      eventId,
      eventType: input.eventType,
      timestamp: new Date().toISOString(),
      data: input.data,
    });
  } catch (error) {
    // Belt-and-suspenders: enqueueOrLog already swallows errors, but this
    // function's contract is "never throws" regardless of what changes
    // underneath it later.
    logger.warn(
      { error, companyId: input.companyId, eventType: input.eventType },
      'emitDomainEvent failed — automation event was not queued (ERP operation is unaffected)'
    );
  }
}
