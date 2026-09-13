import type { Prisma } from '@prisma/client';
import prisma from '../../../shared/database/prisma';
import { logger } from '../../../shared/logger';

export type DocumentEntityType = 'INVOICE' | 'JOURNAL_ENTRY' | 'STOCK_MOVEMENT';

export type DocumentAuditAction =
  | 'CREATED'
  | 'UPDATED'
  | 'SUBMITTED'
  | 'APPROVED'
  | 'REJECTED'
  | 'POSTED'
  | 'UNPOSTED'
  | 'REVERSED'
  | 'CANCELLED';

const ACTION_LABELS_AR: Record<DocumentAuditAction, string> = {
  CREATED: 'أنشأ المسودة',
  UPDATED: 'عدّل المستند',
  SUBMITTED: 'أرسل للاعتماد',
  APPROVED: 'اعتمد المستند',
  REJECTED: 'رفض المستند',
  POSTED: 'رحّل المستند',
  UNPOSTED: 'فك ترحيل المستند',
  REVERSED: 'عكس القيد بقيد معكوس',
  CANCELLED: 'ألغى المستند',
};

type Db = Prisma.TransactionClient | typeof prisma;

async function resolveUserDisplayName(userId: string): Promise<string> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { firstName: true, lastName: true, username: true },
  });
  if (!user) return userId.slice(0, 8);
  const name = [user.firstName, user.lastName].filter(Boolean).join(' ').trim();
  return name || user.username;
}

export function formatDocumentAuditMessage(
  userName: string,
  action: DocumentAuditAction,
  detail?: string
): string {
  const base = `${userName} ${ACTION_LABELS_AR[action]}`;
  return detail ? `${base} — ${detail}` : base;
}

export class DocumentAuditService {
  async record(
    params: {
      companyId: string;
      entityType: DocumentEntityType;
      entityId: string;
      action: DocumentAuditAction;
      userId: string;
      userName?: string;
      metadata?: Record<string, unknown>;
      message?: string;
    },
    tx?: Prisma.TransactionClient
  ) {
    const db: Db = tx ?? prisma;
    try {
      const userName = params.userName ?? (await resolveUserDisplayName(params.userId));
      const message =
        params.message ?? formatDocumentAuditMessage(userName, params.action);

      await db.activityLog.create({
        data: {
          tenantId: params.companyId,
          actorId: params.userId,
          kind: 'document-audit',
          subjectType: params.entityType,
          subjectId: params.entityId,
          severity: 'info',
          reason: message,
          metadata: {
            action: params.action,
            userName,
            entityType: params.entityType,
            entityId: params.entityId,
            ...params.metadata,
          },
        },
      });
    } catch (error) {
      logger.error({ error, params }, 'Failed to record document audit entry');
    }
  }

  async listForEntity(
    companyId: string,
    entityType: DocumentEntityType,
    entityId: string,
    options: { page?: number; limit?: number } = {}
  ) {
    const page = options.page ?? 1;
    const limit = Math.min(options.limit ?? 50, 100);
    const skip = (page - 1) * limit;

    const where = {
      tenantId: companyId,
      kind: 'document-audit',
      subjectType: entityType,
      subjectId: entityId,
    };

    const [logs, total] = await Promise.all([
      prisma.activityLog.findMany({
        where,
        skip,
        take: limit,
        orderBy: { at: 'asc' },
      }),
      prisma.activityLog.count({ where }),
    ]);

    return {
      logs: logs.map((log) => {
        const meta = (log.metadata ?? {}) as Record<string, unknown>;
        return {
          id: log.id,
          entityType: log.subjectType,
          entityId: log.subjectId,
          action: (meta.action as DocumentAuditAction) ?? 'UPDATED',
          userId: log.actorId,
          userName: (meta.userName as string) ?? log.actorId,
          message: log.reason,
          metadata: meta,
          createdAt: log.at,
        };
      }),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }
}

export const documentAuditService = new DocumentAuditService();
