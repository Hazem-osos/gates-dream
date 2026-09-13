import type { Prisma } from '@prisma/client';
import prisma from '../../../shared/database/prisma';
import { AUTOMATION_SYSTEM_ACTOR_ID } from '../../automation/constants';
import { logger } from '../../../shared/logger';

function actorId(userId?: string): string {
  return userId && /^[0-9a-f-]{36}$/i.test(userId) ? userId : AUTOMATION_SYSTEM_ACTOR_ID;
}

export async function logGrowthActivity(input: {
  companyId: string;
  kind: string;
  subjectId: string;
  reason: string;
  userId?: string;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  try {
    await prisma.activityLog.create({
      data: {
        tenantId: input.companyId,
        actorId: actorId(input.userId),
        kind: input.kind,
        subjectType: 'GrowthOpportunity',
        subjectId: input.subjectId,
        severity: 'info',
        reason: input.reason,
        metadata: (input.metadata ?? {}) as Prisma.InputJsonValue,
      },
    });
  } catch (error) {
    logger.warn({ error, kind: input.kind, subjectId: input.subjectId }, 'Growth activity log failed');
  }
}
