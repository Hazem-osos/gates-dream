import {
  sanitizeErrorMessage,
  sanitizeResultMetadata,
  type AutomationActionRunRecord,
} from './automation-action-run.types';

export type AutomationActionRunView = {
  id: string;
  companyId: string;
  eventId: string;
  eventType: string | null;
  ruleId: string;
  ruleName: string | null;
  actionType: string;
  correlationId: string;
  status: AutomationActionRunRecord['status'];
  attemptCount: number;
  startedAt: Date;
  completedAt: Date | null;
  resultEntityType: string | null;
  resultEntityId: string | null;
  resultMetadata: unknown;
  lastErrorCode: string | null;
  errorMessage: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export function toAutomationActionRunView(
  run: AutomationActionRunRecord,
  ruleName: string | null = null
): AutomationActionRunView {
  return {
    id: run.id,
    companyId: run.companyId,
    eventId: run.eventId,
    eventType: run.eventType,
    ruleId: run.ruleId,
    ruleName,
    actionType: run.actionType,
    correlationId: run.correlationId,
    status: run.status,
    attemptCount: run.attemptCount,
    startedAt: run.startedAt,
    completedAt: run.completedAt,
    resultEntityType: run.resultEntityType,
    resultEntityId: run.resultEntityId,
    resultMetadata: sanitizeResultMetadata(
      run.resultMetadata && typeof run.resultMetadata === 'object' && !Array.isArray(run.resultMetadata)
        ? (run.resultMetadata as Record<string, unknown>)
        : null
    ),
    lastErrorCode: run.lastErrorCode,
    errorMessage: sanitizeErrorMessage(run.errorMessage ?? null),
    createdAt: run.createdAt,
    updatedAt: run.updatedAt,
  };
}
