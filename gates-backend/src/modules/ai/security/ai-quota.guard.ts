import { AsyncLocalStorage } from 'node:async_hooks';
import type { NextFunction, Response } from 'express';
import prisma from '../../../shared/database/prisma';
import { AppError } from '../../../shared/middleware/error-handler';
import { logger } from '../../../shared/logger';
import type { AuthRequest } from '../../../shared/auth/types';

const QUOTA_WINDOW_MS = 30 * 24 * 60 * 60 * 1000;

const quotaAls = new AsyncLocalStorage<{ companyId: string }>();

export class QuotaExceededException extends AppError {
  readonly renewsAt: Date;
  readonly limit: number;

  constructor(limit: number, renewsAt: Date) {
    const when = renewsAt.toLocaleDateString('ar-EG', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
    super(
      429,
      `تم استهلاك رصيد باقة الذكاء الاصطناعي للشهر الحالي بالكامل (${limit} رمز). سيتم تجديد الرصيد في ${when} أو يمكنك ترقية الباقة.`
    );
    this.limit = limit;
    this.renewsAt = renewsAt;
    Object.setPrototypeOf(this, QuotaExceededException.prototype);
  }
}

export function getAiQuotaCompanyId(): string | undefined {
  return quotaAls.getStore()?.companyId;
}

export async function runWithAiQuota<T>(companyId: string, fn: () => T | Promise<T>): Promise<T> {
  return quotaAls.run({ companyId }, async () => fn());
}

export type AiQuotaSnapshot = {
  used: number;
  limit: number;
  remaining: number;
  resetAt: Date;
};

function nextResetDate(from: Date, now: Date): Date {
  let cursor = new Date(from);
  while (now.getTime() >= cursor.getTime() + QUOTA_WINDOW_MS) {
    cursor = new Date(cursor.getTime() + QUOTA_WINDOW_MS);
  }
  return cursor;
}

export async function readAiQuota(companyId: string): Promise<AiQuotaSnapshot> {
  const company = await prisma.company.findFirst({
    where: { id: companyId, deletedAt: null },
    select: {
      aiMonthlyTokenLimit: true,
      aiTokensUsedThisMonth: true,
      aiQuotaResetDate: true,
    },
  });
  if (!company) throw new AppError(404, 'Company not found');

  const now = new Date();
  let used = company.aiTokensUsedThisMonth;
  let resetAt = company.aiQuotaResetDate;

  if (now.getTime() >= resetAt.getTime() + QUOTA_WINDOW_MS) {
    const advanced = nextResetDate(resetAt, now);
    await prisma.company.update({
      where: { id: companyId },
      data: { aiTokensUsedThisMonth: 0, aiQuotaResetDate: advanced },
    });
    used = 0;
    resetAt = advanced;
  }

  const renewsAt = new Date(resetAt.getTime() + QUOTA_WINDOW_MS);
  return {
    used,
    limit: company.aiMonthlyTokenLimit,
    remaining: Math.max(0, company.aiMonthlyTokenLimit - used),
    resetAt: renewsAt,
  };
}

export async function assertAiQuota(companyId: string): Promise<AiQuotaSnapshot> {
  const snapshot = await readAiQuota(companyId);
  if (snapshot.used >= snapshot.limit) {
    throw new QuotaExceededException(snapshot.limit, snapshot.resetAt);
  }
  return snapshot;
}

export async function incrementAiTokens(companyId: string, totalTokens: number): Promise<void> {
  const tokens = Math.max(0, Math.floor(totalTokens));
  if (!companyId || tokens <= 0) return;
  try {
    await prisma.company.update({
      where: { id: companyId },
      data: { aiTokensUsedThisMonth: { increment: tokens } },
    });
  } catch (error) {
    logger.warn(
      { err: error, companyId, tokens, message: error instanceof Error ? error.message : String(error) },
      'Failed to increment AI token usage'
    );
  }
}

export async function recordAiUsageFromResponse(usage?: { total_tokens?: number } | null): Promise<void> {
  const companyId = getAiQuotaCompanyId();
  const tokens = usage?.total_tokens;
  if (!companyId || typeof tokens !== 'number') return;
  await incrementAiTokens(companyId, tokens);
}

export function aiQuotaGuard(req: AuthRequest, _res: Response, next: NextFunction) {
  const companyId = req.companyId || req.tenantId;
  if (!companyId) {
    return next(new AppError(400, 'Company context is required'));
  }
  void assertAiQuota(companyId)
    .then(() => {
      quotaAls.run({ companyId }, () => next());
    })
    .catch(next);
}

export { QUOTA_WINDOW_MS };
