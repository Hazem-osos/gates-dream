import { NextFunction, RequestHandler, Response } from 'express';
import type { AuthRequest } from '../auth/types';
import { jwtVerificationService } from '../auth/jwt.verify';
import { authenticate } from './auth.middleware';
import { anonymousApiContext } from './anonymous-api-context.middleware';
import { logger } from '../logger';

export type ApiAuthMode = 'enforce' | 'anonymous';

const VALID_MODES: ApiAuthMode[] = ['enforce', 'anonymous'];

/**
 * Resolves the API auth mode.
 *
 * `API_AUTH_MODE=enforce`   → every /api/v1 request requires a valid JWT.
 * `API_AUTH_MODE=anonymous` → dev open mode when no Bearer token; **JWT honored when sent**.
 *
 * Production always uses `enforce` and refuses to start in `anonymous`.
 *
 * H21 fix (Item 39): outside production, this used to *default* to
 * `anonymous` whenever `API_AUTH_MODE` was unset — so a mis-set/unset
 * `NODE_ENV` on a staging box (anything other than the literal string
 * `"production"`) silently served the entire API unauthenticated, attaching
 * a synthetic admin role to every request. The safe choice now requires an
 * explicit opt-in: `anonymous` only ever applies when `API_AUTH_MODE` is
 * set to it in the environment (see `.env.example`'s local-dev-only
 * comment); every other case — including a blank/misconfigured
 * environment — defaults to `enforce`.
 */
export function resolveApiAuthMode(env: NodeJS.ProcessEnv = process.env): ApiAuthMode {
  const isProduction = env.NODE_ENV === 'production';
  const raw = env.API_AUTH_MODE?.trim().toLowerCase();

  if (raw && !VALID_MODES.includes(raw as ApiAuthMode)) {
    throw new Error(
      `Invalid API_AUTH_MODE="${raw}". Expected one of: ${VALID_MODES.join(', ')}`
    );
  }

  if (isProduction) {
    if (raw === 'anonymous') {
      throw new Error(
        'API_AUTH_MODE=anonymous is not allowed when NODE_ENV=production. Remove it or set API_AUTH_MODE=enforce.'
      );
    }
    return 'enforce';
  }

  return (raw as ApiAuthMode) ?? 'enforce';
}

/**
 * Single entry point mounted on `/api/v1`: delegates to `authenticate` or the
 * dev anonymous context depending on the resolved mode.
 */
export function apiAuthGate(env: NodeJS.ProcessEnv = process.env): RequestHandler {
  const mode = resolveApiAuthMode(env);

  if (mode === 'enforce') {
    logger.info({ apiAuthMode: mode }, 'API auth enforced (JWT required on /api/v1)');
    return authenticate;
  }

  logger.warn(
    { apiAuthMode: mode },
    'API anonymous fallback when no Bearer token (local dev only). Logged-in requests use JWT.'
  );

  const anonymousOrJwt: RequestHandler = (
    req: AuthRequest,
    res: Response,
    next: NextFunction
  ) => {
    const token = jwtVerificationService.extractTokenFromHeader(req.headers.authorization);
    if (token) {
      return authenticate(req, res, next);
    }
    return anonymousApiContext(req, res, next);
  };

  return anonymousOrJwt;
}
