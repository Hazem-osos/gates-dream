/**
 * Platform-level access rules for tenant requests and logins:
 *   1. maintenance mode (whole platform),
 *   2. the company's license window (TenantSubscription), and
 *   3. the user still existing and being active.
 *
 * Lookups go through the shared cache (short TTLs, invalidated by every admin change). Only a
 * definite "no" blocks: if a lookup itself fails, the request is allowed and the failure is
 * logged, so a cache/DB blip cannot lock every tenant out.
 *
 * A company with NO subscription row stays unrestricted — that is the existing licensing
 * contract (`LicenseSubscriptionService.getCurrent` → `unrestricted: true`).
 */
import prisma from '../../../shared/database/prisma';
import { env } from '../../../shared/config/env';
import { logger } from '../../../shared/logger';
import { AppError } from '../../../shared/middleware/error-handler';
import { getTenantCached, invalidateTenantCache } from '../../../shared/cache/tenant-metadata-cache';
import { getPlatformSettings } from './platform-settings.service';
import {
  assertOnPremLoginAllowed,
  assertOnPremUserSeat,
} from '../../../shared/onprem-license/onprem-license';

export const platformAccessCacheKeys = {
  company: (companyId: string) => `platform:access:company:${companyId}`,
  user: (userId: string) => `platform:access:user:${userId}`,
};

interface CachedCompanyAccess {
  isActive: boolean;
  deleted: boolean;
  sub: {
    planType: string;
    status: string;
    startDate: string | Date;
    expiryDate: string | Date | null;
  } | null;
}

interface CachedUserAccess {
  exists: boolean;
  isActive: boolean;
}

export type LicenseState = 'UNLICENSED' | 'ACTIVE' | 'TRIAL' | 'SUSPENDED' | 'EXPIRED' | 'NOT_STARTED';

function formatDateAr(d: Date): string {
  return d.toLocaleDateString('ar-EG', { year: 'numeric', month: 'long', day: 'numeric' });
}

/** Pure: what a subscription row means right now. Dates may arrive as strings from the cache. */
export function evaluateLicenseState(
  sub: CachedCompanyAccess['sub'],
  now: Date = new Date()
): { state: LicenseState; startDate?: Date; expiryDate?: Date | null } {
  if (!sub) return { state: 'UNLICENSED' };
  const startDate = new Date(sub.startDate);
  const expiryDate = sub.expiryDate ? new Date(sub.expiryDate) : null;
  if (sub.status === 'SUSPENDED') return { state: 'SUSPENDED', startDate, expiryDate };
  if (sub.status === 'EXPIRED') return { state: 'EXPIRED', startDate, expiryDate };
  if (sub.status !== 'ACTIVE' && sub.status !== 'TRIAL') return { state: 'SUSPENDED', startDate, expiryDate };
  if (!Number.isNaN(startDate.getTime()) && startDate.getTime() > now.getTime()) {
    return { state: 'NOT_STARTED', startDate, expiryDate };
  }
  // Same rule as LicenseSubscriptionService.isSubscriptionUsable: LIFETIME never expires.
  if (sub.planType === 'SUBSCRIPTION' && expiryDate && expiryDate.getTime() < now.getTime()) {
    return { state: 'EXPIRED', startDate, expiryDate };
  }
  return { state: sub.status === 'TRIAL' ? 'TRIAL' : 'ACTIVE', startDate, expiryDate };
}

function licenseBlockError(
  evaluation: ReturnType<typeof evaluateLicenseState>
): AppError | null {
  switch (evaluation.state) {
    case 'SUSPENDED':
      return new AppError(403, 'ترخيص الشركة موقوف. تواصل مع إدارة Gates لإعادة التفعيل.', true, 'LICENSE_SUSPENDED');
    case 'EXPIRED':
      return new AppError(
        403,
        evaluation.expiryDate
          ? `انتهت صلاحية ترخيص الشركة في ${formatDateAr(evaluation.expiryDate)}. تواصل مع إدارة Gates للتجديد.`
          : 'انتهت صلاحية ترخيص الشركة. تواصل مع إدارة Gates للتجديد.',
        true,
        'LICENSE_EXPIRED'
      );
    case 'NOT_STARTED':
      return new AppError(
        403,
        `ترخيص الشركة يبدأ في ${formatDateAr(evaluation.startDate!)}.`,
        true,
        'LICENSE_NOT_STARTED'
      );
    default:
      return null;
  }
}

async function loadCompanyAccess(companyId: string): Promise<CachedCompanyAccess | null> {
  return getTenantCached(
    platformAccessCacheKeys.company(companyId),
    async () => {
      const company = await prisma.company.findUnique({
        where: { id: companyId },
        select: {
          isActive: true,
          deletedAt: true,
          tenantSubscription: {
            select: { planType: true, status: true, startDate: true, expiryDate: true },
          },
        },
      });
      if (!company) return null;
      return {
        isActive: company.isActive,
        deleted: Boolean(company.deletedAt),
        sub: company.tenantSubscription ?? null,
      };
    },
    30,
    120
  );
}

async function loadUserAccess(userId: string): Promise<CachedUserAccess> {
  return getTenantCached(
    platformAccessCacheKeys.user(userId),
    async () => {
      const user = await prisma.user.findUnique({ where: { id: userId }, select: { isActive: true } });
      return { exists: Boolean(user), isActive: Boolean(user?.isActive) };
    },
    30,
    120
  );
}

async function maintenanceError(): Promise<AppError | null> {
  const settings = await getPlatformSettings();
  return settings.maintenance.enabled
    ? new AppError(503, settings.maintenance.message, true, 'PLATFORM_MAINTENANCE')
    : null;
}

async function companyError(companyId: string): Promise<AppError | null> {
  let access: CachedCompanyAccess | null;
  try {
    access = await loadCompanyAccess(companyId);
  } catch (err) {
    logger.warn({ err, companyId }, '[PlatformAccess] company lookup failed — allowing');
    return null;
  }
  if (!access) return null; // "company not found" is reported by the existing tenant check
  if (!access.isActive || access.deleted) {
    return new AppError(403, 'تم إيقاف حساب الشركة. تواصل مع إدارة Gates.', true, 'COMPANY_DISABLED');
  }
  return licenseBlockError(evaluateLicenseState(access.sub));
}

async function userError(userId: string): Promise<AppError | null> {
  let access: CachedUserAccess;
  try {
    access = await loadUserAccess(userId);
  } catch (err) {
    logger.warn({ err, userId }, '[PlatformAccess] user lookup failed — allowing');
    return null;
  }
  // Keycloak `sub` is not a Gates user id, so "not found" only means something for local logins.
  if (!access.exists && !env.KEYCLOAK_ENABLED) {
    return new AppError(401, 'هذا المستخدم لم يعد موجوداً. سجّل الدخول مرة أخرى.', true, 'USER_REMOVED');
  }
  if (access.exists && !access.isActive) {
    return new AppError(403, 'تم إيقاف هذا المستخدم. تواصل مع مدير النظام.', true, 'USER_DISABLED');
  }
  return null;
}

/** Called by setTenantContext on every tenant request. Throws AppError to block. */
export async function assertTenantRequestAllowed(input: {
  companyId: string;
  userId?: string;
  checkUser: boolean;
}): Promise<void> {
  const maintenance = await maintenanceError();
  if (maintenance) throw maintenance;
  const company = await companyError(input.companyId);
  if (company) throw company;
  if (input.checkUser && input.userId) {
    const user = await userError(input.userId);
    if (user) throw user;
  }
}

/** Called by the password login after the password matched. */
export async function assertLoginAllowed(companyId: string, userId?: string): Promise<void> {
  const maintenance = await maintenanceError();
  if (maintenance) throw maintenance;
  const company = await companyError(companyId);
  if (company) throw company;
  // On-prem (exe) installs: machine license + user limit. No-op on the SaaS deployment.
  if (userId) await assertOnPremLoginAllowed(userId);
}

/**
 * License seat limits. A company without a subscription row stays unrestricted (existing contract).
 * Read straight from the DB: it runs only when a user/branch is added or re-enabled, not per request.
 */
export async function assertWithinLicenseLimit(
  companyId: string,
  kind: 'users' | 'branches',
  adding = 1
): Promise<void> {
  // On-prem (exe) installs: user limit from the machine license. No-op on the SaaS deployment.
  if (kind === 'users') await assertOnPremUserSeat(adding);
  const sub = await prisma.tenantSubscription.findUnique({
    where: { companyId },
    select: { maxUsers: true, maxBranches: true },
  });
  if (!sub) return;
  if (kind === 'users') {
    const used = await prisma.user.count({ where: { companyId, isActive: true } });
    if (used + adding > sub.maxUsers) {
      throw new AppError(
        403,
        `وصلت الشركة للحد الأقصى من المستخدمين في الترخيص (${sub.maxUsers}). أوقف مستخدماً أو تواصل مع إدارة Gates لزيادة الحد.`,
        true,
        'LICENSE_USER_LIMIT'
      );
    }
    return;
  }
  const used = await prisma.branch.count({ where: { companyId, deletedAt: null } });
  if (used + adding > sub.maxBranches) {
    throw new AppError(
      403,
      `وصلت الشركة للحد الأقصى من الفروع في الترخيص (${sub.maxBranches}). تواصل مع إدارة Gates لزيادة الحد.`,
      true,
      'LICENSE_BRANCH_LIMIT'
    );
  }
}


export async function invalidateCompanyAccess(companyId: string): Promise<void> {
  await invalidateTenantCache(platformAccessCacheKeys.company(companyId));
}

export async function invalidateUserAccess(userId: string): Promise<void> {
  await invalidateTenantCache(platformAccessCacheKeys.user(userId));
}
