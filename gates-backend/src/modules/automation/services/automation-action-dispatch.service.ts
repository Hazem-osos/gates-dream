/**
 * Generic executor for GATES-side automation actions that are NOT
 * gates.createPurchaseRequest (which keeps its own dedicated service/route
 * — preserved unmodified). Reuses the SAME AutomationActionRun claim/
 * markSucceeded/markFailed ledger, so every action type gets the same
 * idempotency/observability guarantees for free.
 */
import type { AutomationActionRunService } from './automation-action-run.service';
import {
  AutomationActionDispatchError,
  type ActionExecutionContext,
  type ActionHandler,
} from './automation-action-dispatch.types';

export interface DispatchActionInput extends ActionExecutionContext {
  actionType: string;
}

export interface DispatchActionResult {
  success: true;
  duplicate: boolean;
  resultEntityType: string | null;
  resultEntityId: string | null;
}

export interface CompanyGate {
  assertActive(companyId: string): Promise<void>;
}

export class AutomationActionDispatchService {
  private readonly handlers: Map<string, ActionHandler>;

  constructor(
    handlers: ActionHandler[],
    private readonly runs: AutomationActionRunService,
    private readonly companyGate: CompanyGate
  ) {
    this.handlers = new Map(handlers.map((handler) => [handler.actionType, handler]));
  }

  supports(actionType: string): boolean {
    return this.handlers.has(actionType);
  }

  async execute(input: DispatchActionInput): Promise<DispatchActionResult> {
    const handler = this.handlers.get(input.actionType);
    if (!handler) {
      throw new AutomationActionDispatchError(400, `Unsupported action type "${input.actionType}"`);
    }

    await this.companyGate.assertActive(input.companyId);

    const claim = await this.runs.claim({
      companyId: input.companyId,
      eventId: input.eventId,
      ruleId: input.ruleId,
      actionType: handler.actionType,
      correlationId: input.correlationId,
      eventType: input.eventType,
    });

    if (claim.kind === 'existing') {
      return {
        success: true,
        duplicate: true,
        resultEntityType: claim.run.resultEntityType,
        resultEntityId: claim.run.resultEntityId,
      };
    }
    if (claim.kind === 'in_progress') {
      throw new AutomationActionDispatchError(
        409,
        'Automation action is already in progress. Retry shortly.'
      );
    }

    try {
      const result = await handler.execute(input);
      await this.runs.markSucceeded(input.companyId, claim.run.id, result);
      return {
        success: true,
        duplicate: false,
        resultEntityType: result.resultEntityType,
        resultEntityId: result.resultEntityId,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Action execution failed';
      const statusCode = error instanceof AutomationActionDispatchError ? error.statusCode : 500;
      await this.runs.markFailed(input.companyId, claim.run.id, {
        errorMessage: message,
        lastErrorCode: statusCode < 500 ? 'DOMAIN_ERROR' : 'INTERNAL_ERROR',
      });
      if (error instanceof AutomationActionDispatchError) throw error;
      throw new AutomationActionDispatchError(500, message);
    }
  }
}
