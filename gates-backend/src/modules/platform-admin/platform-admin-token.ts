/**
 * Platform admin tokens — deliberately NOT tenant tokens.
 *
 * Signed with a key that differs from `JWT_DEV_SECRET`, and carrying their own audience and
 * `typ`, so a platform token is rejected by the tenant `authenticate` middleware and a tenant
 * token (even a company `admin`) is rejected by the platform admin guard.
 *
 * `sv` is the admin's session version at sign-in; bumping `PlatformAdmin.sessionVersion`
 * (password, 2FA or role change, deactivation) makes every older token stop working.
 */
import { createHash, randomUUID } from 'node:crypto';
import jwt from 'jsonwebtoken';
import { env } from '../../shared/config/env';
import { AppError } from '../../shared/middleware/error-handler';

export const PLATFORM_ADMIN_TOKEN_TTL_SECONDS = 12 * 60 * 60;
const AUDIENCE = 'gates-platform-admin';
const TOKEN_TYPE = 'platform_admin';

export interface PlatformAdminTokenPayload {
  sub: string;
  email: string;
  typ: typeof TOKEN_TYPE;
  /** Session version; tokens issued before this field existed count as 0. */
  sv: number;
}

function signingKey(): string {
  const explicit = process.env.PLATFORM_ADMIN_JWT_SECRET?.trim();
  if (explicit) {
    if (explicit.length < 32) {
      throw new AppError(503, 'PLATFORM_ADMIN_JWT_SECRET يجب أن يكون 32 حرفاً على الأقل');
    }
    return explicit;
  }
  if (env.JWT_DEV_SECRET) {
    // Derived, so it never equals the tenant signing key.
    return createHash('sha256').update(`gates-platform-admin:${env.JWT_DEV_SECRET}`).digest('hex');
  }
  throw new AppError(503, 'لوحة إدارة المنصة غير مهيأة على هذا الخادم');
}

/** A 32-byte key for a named purpose, derived from the admin signing key (never the key itself). */
export function deriveAdminKey(purpose: string): Buffer {
  return createHash('sha256').update(`${purpose}:${signingKey()}`).digest();
}

export function signPlatformAdminToken(admin: { id: string; email: string; sessionVersion?: number }): {
  accessToken: string;
  expiresIn: number;
} {
  const payload: PlatformAdminTokenPayload = {
    sub: admin.id,
    email: admin.email,
    typ: TOKEN_TYPE,
    sv: admin.sessionVersion ?? 0,
  };
  const accessToken = jwt.sign(payload, signingKey(), {
    algorithm: 'HS256',
    audience: AUDIENCE,
    expiresIn: PLATFORM_ADMIN_TOKEN_TTL_SECONDS,
    jwtid: randomUUID(),
  });
  return { accessToken, expiresIn: PLATFORM_ADMIN_TOKEN_TTL_SECONDS };
}

export function verifyPlatformAdminToken(token: string): PlatformAdminTokenPayload {
  let decoded: jwt.JwtPayload | string;
  try {
    decoded = jwt.verify(token, signingKey(), { algorithms: ['HS256'], audience: AUDIENCE });
  } catch {
    throw new AppError(401, 'انتهت جلسة الإدارة. سجّل الدخول مرة أخرى.');
  }
  if (
    typeof decoded === 'string' ||
    decoded.typ !== TOKEN_TYPE ||
    typeof decoded.sub !== 'string' ||
    typeof decoded.email !== 'string'
  ) {
    throw new AppError(401, 'رمز دخول الإدارة غير صالح');
  }
  const sv = typeof decoded.sv === 'number' && Number.isInteger(decoded.sv) ? decoded.sv : 0;
  return { sub: decoded.sub, email: decoded.email, typ: TOKEN_TYPE, sv };
}
