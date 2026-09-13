/**
 * Auth Middleware — Gates ERP
 *
 * `authenticate`  — required; throws 401 if token is missing/invalid/revoked.
 * `optionalAuth`  — optional; attaches user silently if token is present.
 *
 * Changes from original:
 *  - Static import of `getSession` (was a dynamic import() in the hot path).
 *  - Explicit `RequestHandler` return type on both exports.
 *  - All error paths call `next(new AppError(...))` — no silent swallowing.
 */

import { Response, NextFunction, RequestHandler } from 'express';
import { jwtVerificationService } from '../auth/jwt.verify';
import type { AuthRequest } from '../auth/types';
import { logger } from '../logger';
import { AppError } from './error-handler';
import { isAccountLocked, clearFailedAttempts } from '../security/account-lockout';
import {
  isTokenBlacklisted,
  createSession,
  updateSessionActivity,
  getSession,
} from '../auth/session-manager';

// ── Authenticate (required) ───────────────────────────────────────────────────

/**
 * JWT authentication middleware — must be applied to all protected routes.
 *
 * Attaches `req.user`, `req.companyId`, `req.tenantId`, and `req.branchId`
 * from the verified token payload.
 *
 * Throws:
 *  - 401 — token missing, malformed, expired, or revoked
 *  - 423 — account locked
 */
export const authenticate: RequestHandler = async (
  req: AuthRequest,
  _res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    // Dev open mode (`API_AUTH_MODE=anonymous`) and upstream gates may already attach user context.
    if (req.user?.sub) {
      return next();
    }

    // 1. Extract Bearer token from the Authorization header
    const token = jwtVerificationService.extractTokenFromHeader(
      req.headers.authorization
    );
    if (!token) {
      return next(new AppError(401, 'Authentication required'));
    }

    // 2. Cryptographically verify the token (HS256 dev or RS256 Keycloak)
    const payload = await jwtVerificationService.verifyToken(token);

    // 3. Use jti if present, fall back to sub so we can track session/blacklist
    const tokenId =
      ((payload as unknown) as Record<string, unknown>).jti as string | undefined
      ?? payload.sub;

    // 4. Reject revoked tokens
    const isBlacklisted = await isTokenBlacklisted(tokenId);
    if (isBlacklisted) {
      return next(new AppError(401, 'Token has been revoked'));
    }

    // 5. Reject locked accounts
    const lockoutInfo = await isAccountLocked(payload.sub);
    if (lockoutInfo) {
      const remainingMinutes = Math.ceil(
        (lockoutInfo.lockedUntil - Date.now()) / 60_000
      );
      return next(
        new AppError(
          423,
          `Account is locked due to repeated failed authentication attempts. Try again in ${remainingMinutes} minute(s).`
        )
      );
    }

    // 6. Clear failed-attempt counter on successful auth
    await clearFailedAttempts(payload.sub);

    // 7. Upsert session (create if this token has no active session yet)
    await updateSessionActivity(payload.sub, tokenId);
    const existingSession = await getSession(payload.sub, tokenId);
    if (!existingSession) {
      const ipAddress =
        req.ip ??
        (req.headers['x-forwarded-for'] as string | undefined)
          ?.split(',')[0]
          ?.trim() ??
        'unknown';
      await createSession(
        payload.sub,
        tokenId,
        ipAddress,
        req.headers['user-agent']
      );
    }

    // 8. Attach user context to request
    req.user = payload;
    req.tenantId = payload.tenant_id ?? payload.company_id;
    req.companyId = payload.company_id;
    req.branchId = payload.branch_id;

    logger.debug(
      { userId: payload.sub, email: payload.email, tenantId: req.tenantId },
      'User authenticated'
    );

    next();
  } catch (err) {
    if (err instanceof AppError) {
      return next(err);
    }
    logger.error({ err }, 'Unexpected error during authentication');
    next(new AppError(401, 'Invalid or expired token'));
  }
};

// ── Optional Auth ─────────────────────────────────────────────────────────────

/**
 * Optional authentication middleware.
 *
 * Attaches user context if a valid Bearer token is present.
 * Silently continues if the token is absent or invalid — never throws.
 * Used on public endpoints that can show enriched data when authenticated.
 */
export const optionalAuth: RequestHandler = async (
  req: AuthRequest,
  _res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const token = jwtVerificationService.extractTokenFromHeader(
      req.headers.authorization
    );

    if (token) {
      const payload = await jwtVerificationService.verifyToken(token);
      req.user = payload;
      req.tenantId = payload.tenant_id ?? payload.company_id;
      req.companyId = payload.company_id;
      req.branchId = payload.branch_id;
    }
  } catch (err) {
    // Silently ignore — optionalAuth never blocks the request
    logger.debug({ err }, 'Optional authentication failed (ignored)');
  }

  next();
};
