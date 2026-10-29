/**
 * Tenant login history (success and failure) for the platform admin panel.
 * Written fire-and-forget from the login controller; a write failure never affects the login.
 */
import jwt from 'jsonwebtoken';
import type { Request } from 'express';
import type { Prisma } from '@prisma/client';
import prisma from '../../../shared/database/prisma';
import { logger } from '../../../shared/logger';
import { AppError } from '../../../shared/middleware/error-handler';

function clientIp(req: Request): string | null {
  const fwd = req.headers['x-forwarded-for'];
  const first = typeof fwd === 'string' ? fwd.split(',')[0]?.trim() : undefined;
  return (first || req.ip || '').slice(0, 64) || null;
}

export function loginFailureReason(err: unknown): string {
  if (err instanceof AppError) {
    if (err.code) return err.code.slice(0, 40);
    if (err.statusCode === 401) return 'BAD_CREDENTIALS';
    if (err.statusCode === 423) return 'ACCOUNT_LOCKED';
    if (err.statusCode === 503) return 'UNAVAILABLE';
    return `HTTP_${err.statusCode}`;
  }
  if (err && typeof err === 'object' && 'name' in err && (err as { name: string }).name === 'ZodError') {
    return 'INVALID_INPUT';
  }
  return 'ERROR';
}

export function recordLoginAttempt(
  req: Request,
  input: { identifier: string; success: boolean; accessToken?: string; reason?: string }
): void {
  void (async () => {
    try {
      let userId: string | null = null;
      let companyId: string | null = null;
      if (input.accessToken) {
        const payload = jwt.decode(input.accessToken) as { sub?: string; company_id?: string } | null;
        userId = payload?.sub ?? null;
        companyId = payload?.company_id ?? null;
      } else if (input.identifier) {
        const user = await prisma.user.findFirst({
          where: { OR: [{ email: input.identifier }, { username: input.identifier }] },
          select: { id: true, companyId: true },
        });
        userId = user?.id ?? null;
        companyId = user?.companyId ?? null;
      }
      await prisma.userLoginEvent.create({
        data: {
          userId,
          companyId,
          identifier: input.identifier.slice(0, 191) || '(empty)',
          success: input.success,
          reason: input.success ? null : (input.reason ?? 'ERROR'),
          ip: clientIp(req),
          userAgent: (req.headers['user-agent'] ?? '').slice(0, 255) || null,
        },
      });
    } catch (err) {
      logger.warn({ err }, '[LoginHistory] could not record login attempt');
    }
  })();
}

export async function listLoginEvents(filter: {
  page: number;
  pageSize: number;
  userId?: string;
  companyId?: string;
  success?: 'all' | 'success' | 'failed';
}) {
  const where: Prisma.UserLoginEventWhereInput = {
    ...(filter.userId ? { userId: filter.userId } : {}),
    ...(filter.companyId ? { companyId: filter.companyId } : {}),
    ...(filter.success === 'success' ? { success: true } : {}),
    ...(filter.success === 'failed' ? { success: false } : {}),
  };
  const [total, rows] = await Promise.all([
    prisma.userLoginEvent.count({ where }),
    prisma.userLoginEvent.findMany({
      where,
      orderBy: { at: 'desc' },
      skip: (filter.page - 1) * filter.pageSize,
      take: filter.pageSize,
    }),
  ]);
  const userIds = [...new Set(rows.map((r) => r.userId).filter((v): v is string => Boolean(v)))];
  const companyIds = [...new Set(rows.map((r) => r.companyId).filter((v): v is string => Boolean(v)))];
  const [users, companies] = await Promise.all([
    userIds.length
      ? prisma.user.findMany({ where: { id: { in: userIds } }, select: { id: true, email: true, firstName: true, lastName: true } })
      : [],
    companyIds.length
      ? prisma.company.findMany({ where: { id: { in: companyIds } }, select: { id: true, arabicName: true } })
      : [],
  ]);
  const u = new Map(users.map((x) => [x.id, x]));
  const c = new Map(companies.map((x) => [x.id, x.arabicName]));
  return {
    total,
    page: filter.page,
    pageSize: filter.pageSize,
    rows: rows.map((r) => ({
      ...r,
      user: r.userId ? u.get(r.userId) ?? null : null,
      companyName: r.companyId ? c.get(r.companyId) ?? null : null,
    })),
  };
}

/** Counts for the dashboard / security view. */
export async function loginStats() {
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const [ok, failed, topFailed] = await Promise.all([
    prisma.userLoginEvent.count({ where: { success: true, at: { gte: since } } }),
    prisma.userLoginEvent.count({ where: { success: false, at: { gte: since } } }),
    prisma.userLoginEvent.groupBy({
      by: ['identifier'],
      where: { success: false, at: { gte: since } },
      _count: { _all: true },
      orderBy: { _count: { identifier: 'desc' } },
      take: 5,
    }),
  ]);
  return {
    successLast24h: ok,
    failedLast24h: failed,
    mostFailedLast24h: topFailed.map((t) => ({ identifier: t.identifier, attempts: t._count._all })),
  };
}
