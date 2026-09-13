/**
 * Auth Routes — Gates ERP
 *
 * Pure wiring layer. Business logic lives in:
 *   src/modules/auth/services/auth.service.ts
 *   src/modules/auth/controllers/auth.controller.ts
 *
 * Middleware order per route:
 *   validate()       — Zod schema validation (throws → errorHandler)
 *   authenticate     — JWT auth (protected routes only)
 *   optionalAuth     — optional JWT (verify endpoint)
 *   *Handler         — controller function
 */

import { Router } from 'express';
import { validate } from '../../../shared/middleware/validate';
import { authenticate, optionalAuth } from '../../../shared/middleware/auth.middleware';
import { tokenRefreshRateLimiter } from '../../../shared/middleware/rate-limit.middleware';
import {
  loginSchema,
  registerSchema,
  tokenRefreshSchema,
  logoutSchema,
} from '../schemas/auth.schema';
import {
  registerHandler,
  loginHandler,
  refreshHandler,
  logoutHandler,
  meHandler,
  verifyHandler,
} from '../controllers/auth.controller';

const router = Router();

// ── POST /api/v1/auth/register ────────────────────────────────────────────────
router.post('/register', validate({ body: registerSchema }), registerHandler);

// ── POST /api/v1/auth/login ───────────────────────────────────────────────────
router.post('/login', validate({ body: loginSchema }), loginHandler);

// ── POST /api/v1/auth/refresh ─────────────────────────────────────────────────
router.post(
  '/refresh',
  tokenRefreshRateLimiter,
  validate({ body: tokenRefreshSchema }),
  refreshHandler
);

// ── POST /api/v1/auth/logout ──────────────────────────────────────────────────
router.post('/logout', validate({ body: logoutSchema }), logoutHandler);

// ── GET /api/v1/auth/me (protected) ──────────────────────────────────────────
router.get('/me', authenticate, meHandler);

// Alias for frontend / API docs
router.get('/profile', authenticate, meHandler);

// ── GET /api/v1/auth/verify (optional auth — returns 401 if no token) ─────────
router.get('/verify', optionalAuth, verifyHandler);

export default router;
