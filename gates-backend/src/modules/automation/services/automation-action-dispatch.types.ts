import { sanitizeResultMetadata, type AutomationResultMetadata } from './automation-action-run.types';

export interface ActionExecutionContext {
  companyId: string;
  eventId: string;
  ruleId: string;
  correlationId: string;
  eventType: string;
  config: Record<string, unknown>;
  /** Approved event payload fields, for resolving `{source:'event', field}` bindings. */
  eventData?: Record<string, unknown>;
}

export interface ActionExecutionResult {
  resultEntityType: string;
  resultEntityId: string;
  resultMetadata?: AutomationResultMetadata | null;
}

export interface ActionHandler {
  actionType: string;
  execute(ctx: ActionExecutionContext): Promise<ActionExecutionResult>;
}

export class AutomationActionDispatchError extends Error {
  constructor(
    public readonly statusCode: number,
    message: string
  ) {
    super(message);
    this.name = 'AutomationActionDispatchError';
  }
}

export { sanitizeResultMetadata };
