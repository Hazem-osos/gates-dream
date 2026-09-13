/**
 * Auth Controller — Gates ERP
 *
 * Thin HTTP layer: validates input shape (done by validate() middleware upstream),
 * delegates to AuthService / TokenRefreshService, and serialises the response.
 *
 * Rules:
 *  - Every catch block calls `next(err)` — ZERO inline res.status().json() on error.
 *  - Uses AuthRequest for full TypeScript type safety on req.user / req.companyId.
 *  - No business logic lives here.
 */

import { Response, NextFunction, RequestHandler } from 'express';
import { authService } from '../services/auth.service';
import { tokenRefreshService } from '../../../shared/auth/token-refresh.service';
import { logger } from '../../../shared/logger';
import { AppError } from '../../../shared/middleware/error-handler';
import type { AuthRequest } from '../../../shared/auth/types';
import type { RegisterInput, LoginInput } from '../schemas/auth.schema';

// ── Register ─────────────────────────────────────────────────────────────────

/**
 * POST /api/v1/auth/register
 *
 * Creates a user on the default company (dev mode: KEYCLOAK_ENABLED=false).
 */
export const registerHandler: RequestHandler = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const body = req.body as RegisterInput;
    const result = await authService.register(body);

    logger.info({ userId: result.user.id }, '[Controller] User registered');

    const accessToken = result.token.accessToken;
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    // Top-level token mirrors `data` so thin clients / proxies that unwrap `data` still auto-login.
    res.status(201).json({
      status: 'success',
      message: 'تم إنشاء الحساب',
      accessToken,
      access_token: accessToken,
      data: {
        accessToken,
        tokenType: result.token.tokenType,
        expiresIn: result.token.expiresIn,
        user: result.user,
      },
    });
  } catch (err) {
    next(err);
  }
};

// ── Login ─────────────────────────────────────────────────────────────────────

/**
 * POST /api/v1/auth/login
 *
 * Local dev login: username/email + password when KEYCLOAK_ENABLED=false.
 */
export const loginHandler: RequestHandler = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const body = req.body as LoginInput;
    const result = await authService.login(body);

    logger.info('[Controller] User logged in');

    const accessToken = result.token.accessToken;
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    res.json({
      status: 'success',
      message: 'Logged in successfully',
      accessToken,
      access_token: accessToken,
      data: {
        accessToken,
        tokenType: result.token.tokenType,
        expiresIn: result.token.expiresIn,
      },
    });
  } catch (err) {
    next(err);
  }
};

// ── Token Refresh ─────────────────────────────────────────────────────────────

/**
 * POST /api/v1/auth/refresh
 *
 * Exchanges a Keycloak refresh token for a new access token.
 */
export const refreshHandler: RequestHandler = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { refreshToken } = req.body as { refreshToken: string };
    const tokenData = await tokenRefreshService.refreshToken(refreshToken);

    logger.info({ expiresIn: tokenData.expiresIn }, '[Controller] Token refreshed');

    res.json({
      status: 'success',
      message: 'Token refreshed successfully',
      data: tokenData,
    });
  } catch (err) {
    // Convert token-service errors to typed AppError so errorHandler picks up
    // the right HTTP status code (401 vs 500).
    if (
      err instanceof Error &&
      (err.message.includes('Invalid') || err.message.includes('expired'))
    ) {
      return next(new AppError(401, err.message));
    }
    next(err);
  }
};

// ── Logout ────────────────────────────────────────────────────────────────────

/**
 * POST /api/v1/auth/logout
 *
 * Revokes the Keycloak refresh token.
 */
export const logoutHandler: RequestHandler = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { refreshToken } = req.body as { refreshToken: string };
    await tokenRefreshService.logout(refreshToken);

    logger.info('[Controller] User logged out');

    res.json({
      status: 'success',
      message: 'Logged out successfully',
    });
  } catch (err) {
    if (err instanceof Error && err.message.includes('Invalid')) {
      return next(new AppError(401, err.message));
    }
    next(err);
  }
};

// ── /me ───────────────────────────────────────────────────────────────────────

/**
 * GET /api/v1/auth/me
 *
 * Returns the authenticated user's enriched profile (requires authenticate middleware).
 */
export const meHandler: RequestHandler = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.user) {
      // Shouldn't reach here if the `authenticate` middleware is applied — but
      // guard defensively so the compiler and runtime are both satisfied.
      return next(new AppError(401, 'Authentication required'));
    }

    const userId = req.user.sub;
    const companyId = req.companyId ?? req.tenantId;

    const profile = await authService.getProfile(userId, companyId);

    // Overlay token-sourced data that we don't store in the DB
    profile.branchId = req.user.branch_id ?? req.branchId ?? null;
    profile.roles =
      req.user.realm_access?.roles ??
      req.user.resource_access?.['gates-backend']?.roles ??
      (req.user.role ? [req.user.role] : []);

    logger.info({ userId, companyId }, '[Controller] User profile retrieved');

    res.json({
      status: 'success',
      data: profile,
    });
  } catch (err) {
    next(err);
  }
};

// ── /verify ───────────────────────────────────────────────────────────────────

/**
 * GET /api/v1/auth/verify
 *
 * Verify token and return basic claims — no database lookup (uses optionalAuth middleware).
 */
export const verifyHandler: RequestHandler = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.user) {
      return next(new AppError(401, 'Invalid or missing token'));
    }

    const result = authService.buildVerifyResult(
      req.user,
      req.companyId,
      req.branchId
    );

    res.json({
      status: 'success',
      authenticated: true,
      data: result,
    });
  } catch (err) {
    next(err);
  }
};
