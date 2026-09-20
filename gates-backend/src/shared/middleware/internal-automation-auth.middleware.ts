import { NextFunction, Response } from 'express';
import type { AuthRequest } from '../auth/types';
import { env } from '../config/env';
import { AppError } from './error-handler';
import { logger } from '../logger';
import { verifyAPIKey } from '../security/api-key-manager';
import {
  INTERNAL_AUTOMATION_PERMISSION,
  matchesPlatformAutomationSecret,
  resolveInternalCompanyAccess,
} from './internal-automation-auth.helpers';
import type { InternalAutomationAuth } from './internal-automation-auth.helpers';

export {
  INTERNAL_AUTOMATION_PERMISSION,
  apiKeyMayLookupCompany,
  matchesPlatformAutomationSecret,
  resolveInternalCompanyAccess,
} from './internal-automation-auth.helpers';
export type { InternalAutomationAuth } from './internal-automation-auth.helpers';

export function assertInternalCompanyAccess(
  requestedCompanyId: string,
  auth: InternalAutomationAuth | undefined
): void {
  const decision = resolveInternalCompanyAccess(requestedCompanyId, auth);
  if (decision === 'unauthenticated') {
    throw new AppError(401, 'Authentication required');
  }
  if (decision === 'forbidden') {
    throw new AppError(403, 'API key cannot access another company');
  }
}

function headerApiKey(req: AuthRequest): string | undefined {
  const raw = req.headers['x-api-key'];
  if (typeof raw === 'string' && raw.trim()) return raw.trim();
  if (Array.isArray(raw) && raw[0]?.trim()) return raw[0].trim();

  const auth = req.headers.authorization;
  if (typeof auth === 'string') {
    const match = auth.match(/^ApiKey\s+(.+)$/i);
    if (match?.[1]?.trim()) return match[1].trim();
  }
  return undefined;
}

/**
 * Service-to-service gate for `/internal/v1/automation/*`.
 *
 * Accepts either:
 *   1. `AUTOMATION_INTERNAL_API_KEY` (platform n8n secret from env — never hardcoded)
 *   2. An existing GATES API key (`X-API-Key` / `Authorization: ApiKey …`)
 *
 * Unauthenticated requests are rejected. A tenant-scoped API key cannot
 * query another company. A platform env secret may query any companyId.
 *
 * PRODUCTION TODO: set AUTOMATION_INTERNAL_API_KEY (or issue a dedicated
 * API key with `automation:internal`) before exposing this route. Do not
 * leave the endpoint reachable without a configured secret.
 */
export const authenticateInternalAutomation = async (
  req: AuthRequest,
  _res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const presented = headerApiKey(req);
    if (!presented) {
      return next(new AppError(401, 'Authentication required'));
    }

    if (matchesPlatformAutomationSecret(presented, env.AUTOMATION_INTERNAL_API_KEY)) {
      req.internalAutomation = { source: 'platform-secret' };
      return next();
    }

    const apiKey = await verifyAPIKey(presented);
    if (!apiKey) {
      logger.warn({ path: req.path }, 'Internal automation auth rejected');
      return next(new AppError(401, 'Invalid API key'));
    }

    const scopedCompanyId = apiKey.tenantId?.trim() || undefined;
    if (!scopedCompanyId) {
      const allowed =
        apiKey.permissions.includes('*') ||
        apiKey.permissions.includes(INTERNAL_AUTOMATION_PERMISSION);
      if (!allowed) {
        return next(new AppError(403, 'API key is not permitted for internal automation lookup'));
      }
    }

    req.internalAutomation = {
      source: 'api-key',
      apiKey,
      scopedCompanyId,
    };
    next();
  } catch (error) {
    if (error instanceof AppError) return next(error);
    logger.error({ error }, 'Internal automation auth failed');
    next(new AppError(401, 'Authentication required'));
  }
};
