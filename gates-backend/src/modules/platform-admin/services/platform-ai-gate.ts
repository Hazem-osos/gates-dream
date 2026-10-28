/**
 * Gates Intelligence kill switches set from the platform admin panel:
 *   - platform-wide (`PlatformSetting ai.enabled`), and
 *   - per company (`Company.aiEnabled`).
 *
 * Checked at the `/api/v1/ai` routes (clear error for the user) AND right before every call to
 * the model provider, so background jobs (proactive insights, sentinel, embeddings) stop as well.
 */
import type { NextFunction, Response } from 'express';
import prisma from '../../../shared/database/prisma';
import { logger } from '../../../shared/logger';
import { AppError } from '../../../shared/middleware/error-handler';
import type { AuthRequest } from '../../../shared/auth/types';
import { getTenantCached, invalidateTenantCache } from '../../../shared/cache/tenant-metadata-cache';
import { getPlatformSettings } from './platform-settings.service';

const companyAiKey = (companyId: string) => `platform:ai:company:${companyId}`;

async function companyAiEnabled(companyId: string): Promise<boolean> {
  try {
    return await getTenantCached(
      companyAiKey(companyId),
      async () => {
        const row = await prisma.company.findUnique({ where: { id: companyId }, select: { aiEnabled: true } });
        return row?.aiEnabled !== false;
      },
      30,
      120
    );
  } catch (err) {
    logger.warn({ err, companyId }, '[AiGate] company lookup failed — allowing');
    return true;
  }
}

export async function assertAiAllowed(companyId?: string | null): Promise<void> {
  const settings = await getPlatformSettings();
  if (!settings.aiEnabled) {
    throw new AppError(503, 'تم إيقاف Gates Intelligence مؤقتاً من إدارة المنصة.', true, 'AI_DISABLED');
  }
  if (companyId && !(await companyAiEnabled(companyId))) {
    throw new AppError(
      403,
      'تم إيقاف Gates Intelligence لهذه الشركة. تواصل مع إدارة Gates لإعادة التشغيل.',
      true,
      'AI_DISABLED_FOR_COMPANY'
    );
  }
}

/** Express guard for the AI router. */
export function aiAccessGate(req: AuthRequest, _res: Response, next: NextFunction): void {
  void assertAiAllowed(req.companyId || req.tenantId)
    .then(() => next())
    .catch(next);
}

export async function invalidateCompanyAiGate(companyId: string): Promise<void> {
  await invalidateTenantCache(companyAiKey(companyId));
}
