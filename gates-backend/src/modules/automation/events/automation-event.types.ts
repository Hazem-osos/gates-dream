/**
 * Standard automation event envelope (Task 2 of the capability-catalog
 * brief). This is the ONLY shape GATES ever hands to the event-dispatch
 * worker / n8n intake — no secrets, no giant DB row dumps, only the fields
 * documented per-event in catalog/event-catalog.ts.
 */
export interface AutomationEventEnvelope {
  companyId: string;
  /** Unique per logical occurrence — used as the BullMQ jobId for de-dup and by AutomationActionRun for idempotency downstream. */
  eventId: string;
  eventType: string;
  timestamp: string;
  data: Record<string, unknown>;
}

export type EmitDomainEventInput = {
  companyId: string;
  eventType: string;
  data: Record<string, unknown>;
  /** Defaults to a fresh UUID. Pass an explicit, stable id for naturally-idempotent sources (e.g. a scheduled scan keyed by date). */
  eventId?: string;
};
