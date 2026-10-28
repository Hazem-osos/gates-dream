import type { Prisma } from '@prisma/client';
import prisma from '../../../shared/database/prisma';
import { logger } from '../../../shared/logger';
import type { PlatformAdminRequest } from '../platform-admin.middleware';

export interface PlatformAuditInput {
  action: string;
  targetType: string;
  targetId?: string | null;
  targetCompanyId?: string | null;
  details?: Record<string, unknown>;
}

function clientIp(req: PlatformAdminRequest): string | undefined {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string' && forwarded.trim()) return forwarded.split(',')[0]!.trim().slice(0, 64);
  return req.ip?.slice(0, 64);
}

/** Never fails the admin action itself: an audit write error is logged and swallowed. */
export async function recordPlatformAudit(
  req: PlatformAdminRequest,
  input: PlatformAuditInput,
  actor?: { id: string | null; email: string }
): Promise<void> {
  const admin = actor ?? req.platformAdmin;
  try {
    await prisma.platformAuditLog.create({
      data: {
        adminId: admin?.id ?? null,
        adminEmail: (admin?.email ?? 'unknown').slice(0, 191),
        action: input.action.slice(0, 80),
        targetType: input.targetType.slice(0, 40),
        targetId: input.targetId?.slice(0, 64) ?? null,
        targetCompanyId: input.targetCompanyId?.slice(0, 64) ?? null,
        details: (input.details ?? undefined) as Prisma.InputJsonValue | undefined,
        ip: clientIp(req),
        userAgent: (req.headers['user-agent'] ?? '').slice(0, 255) || null,
      },
    });
  } catch (err) {
    logger.error({ err, action: input.action }, '[PlatformAudit] failed to record');
  }
}

export async function listPlatformAudit(filter: {
  page: number;
  pageSize: number;
  action?: string;
  companyId?: string;
  targetId?: string;
}) {
  const where: Prisma.PlatformAuditLogWhereInput = {
    ...(filter.action ? { action: { startsWith: filter.action } } : {}),
    ...(filter.companyId ? { targetCompanyId: filter.companyId } : {}),
    ...(filter.targetId ? { targetId: filter.targetId } : {}),
  };
  const [total, rows] = await Promise.all([
    prisma.platformAuditLog.count({ where }),
    prisma.platformAuditLog.findMany({
      where,
      orderBy: { at: 'desc' },
      skip: (filter.page - 1) * filter.pageSize,
      take: filter.pageSize,
    }),
  ]);
  return { total, page: filter.page, pageSize: filter.pageSize, rows };
}
