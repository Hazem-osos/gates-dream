import prisma from '../../../shared/database/prisma';
import { logger } from '../../../shared/logger';
import { AUTOMATION_SYSTEM_ACTOR_ID } from '../constants';
import type { AutomationEventName } from '../types/automation-jobs.types';

export interface EmitAutomationEventInput {
  companyId: string;
  event: AutomationEventName;
  title: string;
  message: string;
  type?: string;
  linkUrl?: string | null;
  subjectType: string;
  subjectId: string;
  severity?: 'info' | 'warn' | 'error';
  metadata?: Record<string, unknown>;
}

/**
 * Structured in-app + audit event for treasury/CRM dashboards.
 * SystemNotification.type is VarChar(20); the full event name lives in category + ActivityLog.kind.
 */
export async function emitAutomationEvent(input: EmitAutomationEventInput): Promise<void> {
  const type = (input.type ?? input.event).slice(0, 20);
  const category = input.event.slice(0, 40);

  await prisma.systemNotification.create({
    data: {
      companyId: input.companyId,
      userId: null,
      title: input.title,
      message: input.message,
      type,
      category,
      linkUrl: input.linkUrl ?? null,
      isRead: false,
    },
  });

  await prisma.activityLog.create({
    data: {
      tenantId: input.companyId,
      actorId: AUTOMATION_SYSTEM_ACTOR_ID,
      kind: input.event,
      subjectType: input.subjectType,
      subjectId: input.subjectId,
      severity: input.severity ?? 'info',
      reason: input.title,
      metadata: {
        event: input.event,
        ...input.metadata,
      },
    },
  });

  logger.info(
    { companyId: input.companyId, event: input.event, subjectId: input.subjectId },
    'Automation event emitted'
  );
}
