/**
 * Auth Service — Gates ERP
 *
 * Owns all authentication business logic:
 *  - register()    — create user + resolve/bootstrap company tenant
 *  - login()       — verify credentials + issue JWT
 *  - getProfile()  — fetch enriched user profile from DB
 *  - verifyToken() — transform a JWT payload into a safe verify response
 *
 * Rules:
 *  - Never returns `passwordHash`.
 *  - Throws `AppError` for all known error cases (4xx).
 *  - Throws raw Error only for unexpected/unhandled situations (→ 500 via errorHandler).
 *  - All Prisma calls handle P2002 / P2025 explicitly.
 *  - Explicit TypeScript return types on every method.
 */

import jwt from 'jsonwebtoken';
import { Prisma } from '@prisma/client';
import prisma from '../../../shared/database/prisma';
import { logger } from '../../../shared/logger';
import { env } from '../../../shared/config/env';
import { AppError } from '../../../shared/middleware/error-handler';
import { userService } from '../../users/services/user.service';
import { tenantProvisioningService } from '../../accounting/services/tenant-provisioning.service';
import { refuseProductionSeed } from '../../../shared/config/prod-seed';
import type { JwtPayload } from '../../../shared/auth/types';
import type {
  RegisterInput,
  LoginInput,
} from '../schemas/auth.schema';

// ── Return types ──────────────────────────────────────────────────────────────

export interface AuthTokenResult {
  accessToken: string;
  tokenType: 'Bearer';
  expiresIn: number;
}

export interface RegisterResult {
  token: AuthTokenResult;
  user: {
    id: string;
    email: string;
    username: string;
  };
}

export interface LoginResult {
  token: AuthTokenResult;
}

export interface UserProfileResult {
  id: string;
  email: string;
  username: string;
  firstName: string | null;
  lastName: string | null;
  isActive: boolean;
  companyId: string | null;
  branchId: string | null;
  tenantId: string | null;
  roles: string[];
  company: { id: string; arabicName: string; englishName: string | null } | null;
  branches: Array<{ id: string; arabicName: string }>;
  userGroups: Array<{ id: string; code: string | null; arabicName: string }>;
  permissions: Array<{
    resource: string;
    action: string;
    module: string | null;
    branchId: string | null;
    allow: boolean;
  }>;
  phone: string | null;
  preferredLanguage: string | null;
  avatarUrl: string | null;
  createdAt: Date | null;
  isOnboarded: boolean;
  hasCompletedTour: boolean;
  hasCreatedFirstInvoice: boolean;
}

export interface VerifyResult {
  userId: string;
  email: string;
  username: string;
  companyId: string | null;
  branchId: string | null;
  roles: string[];
}

// ── Helper: resolve or bootstrap company for dev registration ────────────────

/**
 * Returns the `companyId` that a newly registered user should be attached to.
 *
 * Priority:
 *  1. `DEFAULT_REGISTRATION_COMPANY_ID` env var (if the company is active)
 *  2. First active company (oldest by createdAt)
 *  3. Hard-coded seed UUID `00000000-0000-0000-0000-000000000001`
 *  4. (dev only) Any company — even inactive — as a last resort
 *  5. (dev only) Upsert the seed company so registration works on an empty DB
 *
 * Returns `null` in production if no company is available.
 */
async function resolveRegistrationCompanyId(): Promise<string | null> {
  // 1. Env-pinned company
  if (env.DEFAULT_REGISTRATION_COMPANY_ID) {
    const pinned = await prisma.company.findUnique({
      where: { id: env.DEFAULT_REGISTRATION_COMPANY_ID },
      select: { id: true, isActive: true },
    });
    if (pinned?.isActive) return pinned.id;
  }

  // 2. First active company
  const firstActive = await prisma.company.findFirst({
    where: { isActive: true },
    orderBy: { createdAt: 'asc' },
    select: { id: true },
  });
  if (firstActive) return firstActive.id;

  // 3. Seed UUID
  const SEED_ID = '00000000-0000-0000-0000-000000000001';
  const seed = await prisma.company.findUnique({
    where: { id: SEED_ID },
    select: { id: true, isActive: true },
  });
  if (seed?.isActive) return seed.id;

  // 4 & 5. Dev fallback — do NOT do this in production
  if (env.NODE_ENV === 'development') {
    const anyCompany = await prisma.company.findFirst({
      orderBy: { createdAt: 'asc' },
      select: { id: true, isActive: true },
    });

    if (anyCompany) {
      logger.warn(
        { companyId: anyCompany.id, isActive: anyCompany.isActive },
        '[Auth] No active company — using oldest company in dev. Set isActive=true or run seed.'
      );
      return anyCompany.id;
    }

    // Empty DB: upsert the seed company so register works without seed data
    const bootstrapped = await prisma.company.upsert({
      where: { id: SEED_ID },
      create: {
        id: SEED_ID,
        arabicName: 'شركة افتراضية',
        englishName: 'Default Company',
        isActive: true,
      },
      update: { isActive: true, deletedAt: null },
      select: { id: true },
    });

    logger.warn(
      { companyId: bootstrapped.id },
      '[Auth] Created/activated default company in dev (DB was empty). Run npm run seed for full fixtures.'
    );
    if (!refuseProductionSeed()) {
      try {
        await tenantProvisioningService.provisionStandardTenant(bootstrapped.id);
      } catch (e) {
        logger.error({ e, companyId: bootstrapped.id }, '[Auth] Tenant provisioning failed for bootstrapped company');
      }
    }
    return bootstrapped.id;
  }

  return null;
}

// ── Helper: sign a dev JWT ────────────────────────────────────────────────────

const ACCESS_TOKEN_TTL_SECONDS = 8 * 60 * 60; // 8 hours

/**
 * Effective roles for a locally-issued token. Keycloak supplies these in
 * `realm_access`; without it we derive them from the user's grant-all
 * (`resource: '*'`) permission rows so `authorize()` has something to match.
 */
async function resolveUserRoles(userId: string, companyId: string): Promise<string[]> {
  const grantAll = await prisma.userPermission.findFirst({
    where: { userId, companyId, resource: '*', allow: true },
    select: { id: true },
  });
  return grantAll ? ['admin'] : [];
}

function signDevJwt(payload: JwtPayload): AuthTokenResult {
  if (!env.JWT_DEV_SECRET) {
    throw new AppError(503, 'JWT_DEV_SECRET is not configured on this server');
  }

  const accessToken = jwt.sign(payload, env.JWT_DEV_SECRET, {
    algorithm: 'HS256',
    expiresIn: ACCESS_TOKEN_TTL_SECONDS,
  });

  return {
    accessToken,
    tokenType: 'Bearer',
    expiresIn: ACCESS_TOKEN_TTL_SECONDS,
  };
}

// ── Auth Service class ────────────────────────────────────────────────────────

export class AuthService {
  /**
   * Register a new user.
   *
   * Only available when `KEYCLOAK_ENABLED=false` and `JWT_DEV_SECRET` is set.
   * Creates a user on the resolved company tenant and returns an access token.
   *
   * Throws:
   *  - 503  — dev mode not active / no company available
   *  - 409  — email or username already exists
   */
  async register(body: RegisterInput): Promise<RegisterResult> {
    this.assertDevModeActive();

    const companyId = await resolveRegistrationCompanyId();
    if (!companyId) {
      throw new AppError(
        503,
        'لا توجد شركة نشطة في قاعدة البيانات. شغّل npm run seed أو عيّن DEFAULT_REGISTRATION_COMPANY_ID.'
      );
    }

    let user: Awaited<ReturnType<typeof userService.createUser>>;

    try {
      user = await userService.createUser({
        companyId,
        email: body.email,
        username: body.username,
        password: body.password,
        firstName: body.firstName,
        lastName: body.lastName,
      });
    } catch (err) {
      // userService.createUser throws plain Error for duplicates
      if (err instanceof Error) {
        if (err.message.includes('already exists')) {
          const m = err.message.toLowerCase();
          if (m.includes('email')) {
            throw new AppError(
              409,
              'البريد الإلكتروني مستخدم بالفعل. سجّل الدخول أو استخدم بريداً آخر.'
            );
          }
          if (m.includes('username')) {
            throw new AppError(409, 'اسم المستخدم مستخدم. اختر اسماً آخراً أو سجّل الدخول.');
          }
          throw new AppError(409, err.message);
        }
        if (err.message === 'Company not found') {
          throw new AppError(
            503,
            'الشركة المحددة غير موجودة. تحقق من DEFAULT_REGISTRATION_COMPANY_ID أو شغّل seed.'
          );
        }
      }
      // Re-throw Prisma P2002 (unique constraint) as a 409
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === 'P2002'
      ) {
        throw new AppError(409, 'Email or username already exists');
      }
      throw err;
    }

    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      username: user.username,
      company_id: user.companyId,
      tenant_id: user.companyId,
    };

    const token = signDevJwt(payload);

    logger.info({ userId: user.id, companyId }, '[Auth] User registered (development JWT)');

    return {
      token,
      user: { id: user.id, email: user.email, username: user.username },
    };
  }

  /**
   * Validate credentials and issue a JWT.
   *
   * Only available when `KEYCLOAK_ENABLED=false` and `JWT_DEV_SECRET` is set.
   *
   * Throws:
   *  - 503  — dev mode not active
   *  - 401  — user not found, inactive, or password mismatch
   */
  async login(body: LoginInput): Promise<LoginResult> {
    this.assertDevModeActive();

    const { username, password } = body;

    // Lookup by either email or username
    let dbUser: {
      id: string;
      email: string;
      username: string;
      passwordHash: string;
      companyId: string;
    } | null;

    try {
      dbUser = await prisma.user.findFirst({
        where: {
          isActive: true,
          OR: [{ email: username }, { username }],
        },
        select: {
          id: true,
          email: true,
          username: true,
          passwordHash: true,
          companyId: true,
        },
      });
    } catch (err) {
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === 'P2025'
      ) {
        // Treat as "not found" — do not reveal the reason
        dbUser = null;
      } else {
        throw err;
      }
    }

    // Constant-time-ish rejection: always attempt compare even if user not found.
    // This prevents user-enumeration via response-time differences.
    const DUMMY_HASH =
      '$2a$10$abcdefghijklmnopqrstuuABCDEFGHIJKLMNOPQRSTUVWXYZ01234';

    const isMatch = await (async () => {
      const { default: bcrypt } = await import('bcryptjs');
      return bcrypt.compare(password, dbUser?.passwordHash ?? DUMMY_HASH);
    })();

    if (!dbUser || !isMatch) {
      throw new AppError(401, 'Invalid username or password');
    }

    const roles = await resolveUserRoles(dbUser.id, dbUser.companyId);
    const payload: JwtPayload = {
      sub: dbUser.id,
      email: dbUser.email,
      username: dbUser.username,
      company_id: dbUser.companyId,
      tenant_id: dbUser.companyId,
      ...(roles.length ? { realm_access: { roles }, role: roles[0] } : {}),
    };

    const token = signDevJwt(payload);

    logger.info({ userId: dbUser.id, roles }, '[Auth] User logged in (development JWT)');

    return { token };
  }

  /**
   * Fetch enriched profile for an authenticated user from the database.
   *
   * Throws:
   *  - 404 if the user cannot be located in the database for the given company.
   */
  async getProfile(userId: string, companyId: string | undefined): Promise<UserProfileResult> {
    const userSelect = {
      id: true,
      email: true,
      username: true,
      firstName: true,
      lastName: true,
      phone: true,
      preferredLanguage: true,
      avatarUrl: true,
      isActive: true,
      createdAt: true,
      company: {
        select: { id: true, arabicName: true, englishName: true },
      },
      branchPermissions: {
        select: { branch: { select: { id: true, arabicName: true } } },
      },
      groupMemberships: {
        select: {
          userGroup: { select: { id: true, code: true, arabicName: true } },
        },
      },
    } as const;

    type DbUser = {
      id: string;
      email: string;
      username: string;
      firstName: string | null;
      lastName: string | null;
      phone: string | null;
      preferredLanguage: string | null;
      avatarUrl: string | null;
      isActive: boolean;
      createdAt: Date;
      company: { id: string; arabicName: string; englishName: string | null };
      branchPermissions: Array<{ branch: { id: string; arabicName: string } }>;
      groupMemberships: Array<{
        userGroup: { id: string; code: string | null; arabicName: string };
      }>;
      permissions?: Array<{
        resource: string;
        action: string;
        module: string | null;
        branchId: string | null;
        allow: boolean;
      }>;
    };

    let effectiveCompanyId = companyId;
    let dbUser: DbUser | null = null;

    if (companyId) {
      dbUser = await prisma.user.findFirst({
        where: { id: userId, companyId },
        select: {
          ...userSelect,
          permissions: {
            where: { companyId, allow: true },
            select: {
              resource: true,
              action: true,
              module: true,
              branchId: true,
              allow: true,
            },
          },
        },
      });
    }

    if (!dbUser) {
      const byId = await prisma.user.findUnique({
        where: { id: userId },
        select: userSelect,
      });
      if (byId) {
        effectiveCompanyId = byId.company.id;
        const perms = await prisma.userPermission.findMany({
          where: { userId, companyId: effectiveCompanyId, allow: true },
          select: {
            resource: true,
            action: true,
            module: true,
            branchId: true,
            allow: true,
          },
        });
        dbUser = { ...byId, permissions: perms };
      }
    }

    const permissions = dbUser?.permissions ?? [];

    let isOnboarded = false;
    let hasCompletedTour = false;
    let hasCreatedFirstInvoice = false;
    if (effectiveCompanyId) {
      const [company, saleInvoiceCount] = await Promise.all([
        prisma.company.findFirst({
          where: { id: effectiveCompanyId, deletedAt: null },
          select: { isOnboarded: true, hasCompletedTour: true },
        }),
        prisma.invoice.count({
          where: { companyId: effectiveCompanyId, invoiceKind: 'SALE', isCancelled: false },
        }),
      ]);
      isOnboarded = company?.isOnboarded ?? false;
      hasCompletedTour = company?.hasCompletedTour ?? false;
      hasCreatedFirstInvoice = saleInvoiceCount > 0;
    }

    return {
      id: userId,
      email: dbUser?.email ?? '',
      username: dbUser?.username ?? '',
      firstName: dbUser?.firstName ?? null,
      lastName: dbUser?.lastName ?? null,
      isActive: dbUser?.isActive ?? true,
      companyId: effectiveCompanyId ?? null,
      branchId: null, // populated by controller from req context
      tenantId: effectiveCompanyId ?? null,
      roles: [], // populated by controller from JWT payload
      company: dbUser?.company ?? null,
      branches: dbUser?.branchPermissions.map((bp) => bp.branch) ?? [],
      userGroups: dbUser?.groupMemberships.map((gm) => gm.userGroup) ?? [],
      permissions,
      phone: dbUser?.phone ?? null,
      preferredLanguage: dbUser?.preferredLanguage ?? 'ar',
      avatarUrl: dbUser?.avatarUrl ?? null,
      createdAt: dbUser?.createdAt ?? null,
      isOnboarded,
      hasCompletedTour,
      hasCreatedFirstInvoice,
    };
  }

  /**
   * Transform a verified JWT payload into a safe verify response.
   * No database call — this is a pure projection of the in-token claims.
   */
  buildVerifyResult(payload: JwtPayload, companyId: string | undefined, branchId: string | undefined): VerifyResult {
    return {
      userId: payload.sub,
      email: payload.email,
      username: payload.username,
      companyId: payload.company_id ?? companyId ?? null,
      branchId: payload.branch_id ?? branchId ?? null,
      roles:
        payload.realm_access?.roles ??
        payload.resource_access?.['gates-backend']?.roles ??
        (payload.role ? [payload.role] : []),
    };
  }

  // ── Private helpers ────────────────────────────────────────────────────────

  /**
   * Guard: throws 503 when the local-login dev mode is not active.
   */
  private assertDevModeActive(): void {
    if (!env.JWT_DEV_SECRET || env.KEYCLOAK_ENABLED) {
      throw new AppError(
        503,
        'Password login is only available with KEYCLOAK_ENABLED=false and JWT_DEV_SECRET set. Use Keycloak in production.'
      );
    }
  }
}

export const authService = new AuthService();
