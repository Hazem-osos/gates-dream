import { z } from 'zod';

/**
 * Generic internal action-execution request. Covers every GATES-executed
 * action except gates.createPurchaseRequest, which keeps its own dedicated
 * endpoint/schema (`createAutomationPurchaseRequestSchema`) unmodified.
 */
export const executeAutomationActionSchema = z.object({
  companyId: z.string().uuid('companyId must be a company UUID'),
  eventId: z.string().trim().min(1, 'eventId is required'),
  correlationId: z.string().trim().min(1, 'correlationId is required'),
  ruleId: z.string().uuid('ruleId must be a UUID'),
  actionType: z.string().trim().min(1, 'actionType is required'),
  eventType: z.string().trim().min(1, 'eventType is required'),
  /** Raw action config as stored on the rule (constants and/or {source,field} bindings). */
  config: z.record(z.unknown()).default({}),
  /** Approved event payload fields the config may bind against. */
  eventData: z.record(z.unknown()).optional(),
});

export type ExecuteAutomationActionInput = z.infer<typeof executeAutomationActionSchema>;
