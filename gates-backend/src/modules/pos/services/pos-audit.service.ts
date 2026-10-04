import type { Prisma } from '@prisma/client';
import {
  documentAuditService,
  type DocumentAuditAction,
  type DocumentEntityType,
} from '../../accounting/services/document-audit.service';

export async function recordPosAudit(
  params: {
    companyId: string;
    entityType: Extract<DocumentEntityType, 'POS_ORDER' | 'POS_SHIFT'>;
    entityId: string;
    action: DocumentAuditAction;
    userId?: string | null;
    terminalId?: string | null;
    shiftId?: string | null;
    reason?: string | null;
    before?: unknown;
    after?: unknown;
    detail?: Record<string, unknown>;
  },
  tx?: Prisma.TransactionClient
) {
  if (!params.userId) return;
  await documentAuditService.record(
    {
      companyId: params.companyId,
      entityType: params.entityType,
      entityId: params.entityId,
      action: params.action,
      userId: params.userId,
      metadata: {
        terminalId: params.terminalId ?? null,
        shiftId: params.shiftId ?? null,
        reason: params.reason ?? null,
        before: params.before ?? null,
        after: params.after ?? null,
        ...params.detail,
      },
    },
    tx
  );
}
