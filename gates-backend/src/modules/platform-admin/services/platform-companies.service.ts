/**
 * Companies (tenants) as seen from the platform admin panel.
 *
 * These routes run with NO tenant context (mounted before setTenantContext), so the Prisma
 * tenant backstop is inactive here by design — every query below states its own scope.
 */
import type { Prisma } from '@prisma/client';
import prisma from '../../../shared/database/prisma';
import { AppError } from '../../../shared/middleware/error-handler';
import { invalidateTenantCache, tenantCacheKeys } from '../../../shared/cache/tenant-metadata-cache';
import { forgetCompanyStatus } from '../../../shared/middleware/tenant.middleware';
import { companyService } from '../../company/services/company.service';
import { licenseSubscriptionService } from '../../platform/services/license-subscription.service';
import {
  LICENSE_MODULE_CODES,
  type LicenseModuleCode,
  type SubscriptionPlanType,
  type SubscriptionStatus,
} from '../../platform/types/license-modules';
import { evaluateLicenseState, invalidateCompanyAccess } from './platform-access.service';
import { invalidateCompanyAiGate } from './platform-ai-gate';
import { activityDayDate, activityDayKey } from './user-activity-tracker';
import { createTenantUser } from './platform-users.service';

export type CompanyListFilter = {
  page: number;
  pageSize: number;
  search?: string;
  status?: 'all' | 'active' | 'inactive';
  license?: 'all' | 'unlicensed' | 'active' | 'trial' | 'suspended' | 'expired' | 'expiring';
};

const DAY_MS = 24 * 60 * 60 * 1000;

export function daysAgo(n: number): Date {
  return activityDayDate(activityDayKey(new Date(Date.now() - n * DAY_MS)));
}

function licenseWhere(license: CompanyListFilter['license'], now: Date): Prisma.CompanyWhereInput {
  switch (license) {
    case 'unlicensed':
      return { tenantSubscription: { is: null } };
    case 'suspended':
      return { tenantSubscription: { is: { status: 'SUSPENDED' } } };
    case 'trial':
      return { tenantSubscription: { is: { status: 'TRIAL' } } };
    case 'expired':
      return {
        tenantSubscription: {
          is: {
            OR: [
              { status: 'EXPIRED' },
              { planType: 'SUBSCRIPTION', status: { in: ['ACTIVE', 'TRIAL'] }, expiryDate: { lt: now } },
            ],
          },
        },
      };
    case 'expiring':
      return {
        tenantSubscription: {
          is: {
            planType: 'SUBSCRIPTION',
            status: { in: ['ACTIVE', 'TRIAL'] },
            expiryDate: { gte: now, lte: new Date(now.getTime() + 30 * DAY_MS) },
          },
        },
      };
    case 'active':
      return {
        tenantSubscription: {
          is: {
            status: 'ACTIVE',
            OR: [{ planType: 'LIFETIME' }, { expiryDate: null }, { expiryDate: { gte: now } }],
          },
        },
      };
    default:
      return {};
  }
}

function serializeLicense(
  sub: {
    planType: string;
    status: string;
    startDate: Date;
    expiryDate: Date | null;
    maxUsers: number;
    maxBranches: number;
    maxStorageMb: number;
    allowedModules: Prisma.JsonValue;
    updatedAt: Date;
  } | null
) {
  if (!sub) return { state: 'UNLICENSED' as const, subscription: null };
  const { state } = evaluateLicenseState(sub);
  return {
    state,
    subscription: {
      planType: sub.planType,
      status: sub.status,
      startDate: sub.startDate,
      expiryDate: sub.expiryDate,
      maxUsers: sub.maxUsers,
      maxBranches: sub.maxBranches,
      maxStorageMb: sub.maxStorageMb,
      allowedModules: Array.isArray(sub.allowedModules) ? sub.allowedModules : [],
      updatedAt: sub.updatedAt,
    },
  };
}

const subscriptionSelect = {
  planType: true,
  status: true,
  startDate: true,
  expiryDate: true,
  maxUsers: true,
  maxBranches: true,
  maxStorageMb: true,
  allowedModules: true,
  updatedAt: true,
} as const;

export async function listCompanies(filter: CompanyListFilter) {
  const now = new Date();
  const search = filter.search?.trim();
  const where: Prisma.CompanyWhereInput = {
    deletedAt: null,
    ...(filter.status === 'active' ? { isActive: true } : {}),
    ...(filter.status === 'inactive' ? { isActive: false } : {}),
    ...licenseWhere(filter.license, now),
    ...(search
      ? {
          OR: [
            { arabicName: { contains: search } },
            { englishName: { contains: search } },
            { serial: { contains: search } },
            { contactEmail: { contains: search } },
            { phone1: { contains: search } },
          ],
        }
      : {}),
  };

  const [total, companies] = await Promise.all([
    prisma.company.count({ where }),
    prisma.company.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (filter.page - 1) * filter.pageSize,
      take: filter.pageSize,
      select: {
        id: true,
        serial: true,
        arabicName: true,
        englishName: true,
        contactEmail: true,
        phone1: true,
        isActive: true,
        isOnboarded: true,
        aiEnabled: true,
        aiMonthlyTokenLimit: true,
        aiTokensUsedThisMonth: true,
        createdAt: true,
        tenantSubscription: { select: subscriptionSelect },
        _count: { select: { users: true, branches: true } },
      },
    }),
  ]);

  const ids = companies.map((c) => c.id);
  const since = daysAgo(6);
  const [activeUsers, activeUserTotals, activity] = ids.length
    ? await Promise.all([
        prisma.user.groupBy({ by: ['companyId'], where: { companyId: { in: ids }, isActive: true }, _count: { _all: true } }),
        prisma.userActivityDay.groupBy({ by: ['companyId', 'userId'], where: { companyId: { in: ids }, day: { gte: since } } }),
        prisma.userActivityDay.groupBy({
          by: ['companyId'],
          where: { companyId: { in: ids }, day: { gte: since } },
          _sum: { activeMinutes: true },
          _max: { lastSeenAt: true },
        }),
      ])
    : [[], [], []];

  const enabledUsers = new Map(activeUsers.map((r) => [r.companyId, r._count._all]));
  const weekUsers = new Map<string, number>();
  for (const r of activeUserTotals) weekUsers.set(r.companyId, (weekUsers.get(r.companyId) ?? 0) + 1);
  const weekActivity = new Map(activity.map((r) => [r.companyId, r]));

  return {
    total,
    page: filter.page,
    pageSize: filter.pageSize,
    rows: companies.map((c) => ({
      id: c.id,
      serial: c.serial,
      arabicName: c.arabicName,
      englishName: c.englishName,
      contactEmail: c.contactEmail,
      phone1: c.phone1,
      isActive: c.isActive,
      isOnboarded: c.isOnboarded,
      createdAt: c.createdAt,
      users: { total: c._count.users, active: enabledUsers.get(c.id) ?? 0, activeLast7Days: weekUsers.get(c.id) ?? 0 },
      branches: c._count.branches,
      activeMinutesLast7Days: weekActivity.get(c.id)?._sum.activeMinutes ?? 0,
      lastSeenAt: weekActivity.get(c.id)?._max.lastSeenAt ?? null,
      ai: { enabled: c.aiEnabled, limit: c.aiMonthlyTokenLimit, used: c.aiTokensUsedThisMonth },
      license: serializeLicense(c.tenantSubscription),
    })),
  };
}

export async function getCompanyDetail(companyId: string) {
  const company = await prisma.company.findFirst({
    where: { id: companyId },
    select: {
      id: true,
      serial: true,
      arabicName: true,
      englishName: true,
      contactEmail: true,
      phone1: true,
      phone2: true,
      address: true,
      taxNumber1: true,
      isActive: true,
      isOnboarded: true,
      onboardedAt: true,
      deletedAt: true,
      createdAt: true,
      updatedAt: true,
      aiEnabled: true,
      aiMonthlyTokenLimit: true,
      aiTokensUsedThisMonth: true,
      aiQuotaResetDate: true,
      tenantSubscription: { select: subscriptionSelect },
      _count: { select: { users: true, branches: true } },
    },
  });
  if (!company) throw new AppError(404, 'الشركة غير موجودة');

  const since30 = daysAgo(29);
  const [series, invoices, journalEntries, items, customers, suppliers, aiConversations] = await Promise.all([
    prisma.userActivityDay.groupBy({
      by: ['day'],
      where: { companyId, day: { gte: since30 } },
      _sum: { activeMinutes: true, requestCount: true },
      _count: { _all: true },
      orderBy: { day: 'asc' },
    }),
    prisma.invoice.count({ where: { companyId } }),
    prisma.journalEntry.count({ where: { companyId } }),
    prisma.item.count({ where: { companyId } }),
    prisma.customer.count({ where: { companyId } }),
    prisma.supplier.count({ where: { companyId } }),
    prisma.aiConversation.count({ where: { companyId } }),
  ]);

  const { _count, tenantSubscription, ...rest } = company;
  return {
    ...rest,
    counts: { users: _count.users, branches: _count.branches, invoices, journalEntries, items, customers, suppliers, aiConversations },
    ai: {
      enabled: company.aiEnabled,
      limit: company.aiMonthlyTokenLimit,
      used: company.aiTokensUsedThisMonth,
      windowStartedAt: company.aiQuotaResetDate,
    },
    license: serializeLicense(tenantSubscription),
    activity: series.map((r) => ({
      day: r.day,
      activeUsers: r._count._all,
      activeMinutes: r._sum.activeMinutes ?? 0,
      requests: r._sum.requestCount ?? 0,
    })),
  };
}

async function afterCompanyChange(companyId: string): Promise<void> {
  forgetCompanyStatus(companyId);
  await Promise.all([invalidateCompanyAccess(companyId), invalidateCompanyAiGate(companyId)]);
}

export async function updateCompany(
  companyId: string,
  data: {
    arabicName?: string;
    englishName?: string | null;
    contactEmail?: string | null;
    phone1?: string | null;
    address?: string | null;
    taxNumber1?: string | null;
    isActive?: boolean;
  }
) {
  const exists = await prisma.company.findUnique({ where: { id: companyId }, select: { id: true } });
  if (!exists) throw new AppError(404, 'الشركة غير موجودة');
  const updated = await prisma.company.update({
    where: { id: companyId },
    data,
    select: { id: true, arabicName: true, englishName: true, isActive: true },
  });
  await afterCompanyChange(companyId);
  return updated;
}

export async function updateCompanyAi(
  companyId: string,
  data: { enabled?: boolean; monthlyTokenLimit?: number; resetUsage?: boolean }
) {
  const exists = await prisma.company.findUnique({ where: { id: companyId }, select: { id: true } });
  if (!exists) throw new AppError(404, 'الشركة غير موجودة');
  const updated = await prisma.company.update({
    where: { id: companyId },
    data: {
      ...(typeof data.enabled === 'boolean' ? { aiEnabled: data.enabled } : {}),
      ...(typeof data.monthlyTokenLimit === 'number' ? { aiMonthlyTokenLimit: data.monthlyTokenLimit } : {}),
      ...(data.resetUsage ? { aiTokensUsedThisMonth: 0, aiQuotaResetDate: new Date() } : {}),
    },
    select: { aiEnabled: true, aiMonthlyTokenLimit: true, aiTokensUsedThisMonth: true, aiQuotaResetDate: true },
  });
  await afterCompanyChange(companyId);
  return {
    enabled: updated.aiEnabled,
    limit: updated.aiMonthlyTokenLimit,
    used: updated.aiTokensUsedThisMonth,
    windowStartedAt: updated.aiQuotaResetDate,
  };
}

export interface LicenseInput {
  planType: SubscriptionPlanType;
  status: SubscriptionStatus;
  startDate: Date;
  expiryDate: Date | null;
  allowedModules: LicenseModuleCode[];
  maxUsers: number;
  maxBranches: number;
  maxStorageMb: number;
}

export async function setCompanyLicense(companyId: string, input: LicenseInput) {
  const exists = await prisma.company.findUnique({ where: { id: companyId }, select: { id: true } });
  if (!exists) throw new AppError(404, 'الشركة غير موجودة');
  if (input.planType === 'SUBSCRIPTION' && !input.expiryDate) {
    throw new AppError(422, 'الاشتراك المحدد بمدة يحتاج تاريخ انتهاء');
  }
  if (input.expiryDate && input.expiryDate.getTime() <= input.startDate.getTime()) {
    throw new AppError(422, 'تاريخ الانتهاء يجب أن يكون بعد تاريخ البداية');
  }
  await licenseSubscriptionService.activate({
    companyId,
    planType: input.planType,
    status: input.status,
    startDate: input.startDate,
    expiryDate: input.planType === 'LIFETIME' ? null : input.expiryDate,
    allowedModules: input.allowedModules,
    maxUsers: input.maxUsers,
    maxBranches: input.maxBranches,
    maxStorageMb: input.maxStorageMb,
  });
  await afterCompanyChange(companyId);
  const sub = await prisma.tenantSubscription.findUnique({ where: { companyId }, select: subscriptionSelect });
  return serializeLicense(sub);
}

export async function setCompanyLicenseStatus(companyId: string, status: SubscriptionStatus) {
  const sub = await prisma.tenantSubscription.findUnique({ where: { companyId }, select: { id: true } });
  if (!sub) throw new AppError(404, 'لا يوجد ترخيص لهذه الشركة بعد. أنشئ ترخيصاً أولاً.');
  await prisma.tenantSubscription.update({ where: { companyId }, data: { status } });
  await invalidateTenantCache(tenantCacheKeys.subscription(companyId));
  await afterCompanyChange(companyId);
  const fresh = await prisma.tenantSubscription.findUnique({ where: { companyId }, select: subscriptionSelect });
  return serializeLicense(fresh);
}

/** Removing the row returns the company to the legacy "unrestricted" state. */
export async function removeCompanyLicense(companyId: string) {
  await prisma.tenantSubscription.deleteMany({ where: { companyId } });
  await invalidateTenantCache(tenantCacheKeys.subscription(companyId));
  await afterCompanyChange(companyId);
  return serializeLicense(null);
}

export async function createCompanyWithAdmin(input: {
  arabicName: string;
  englishName?: string;
  contactEmail?: string;
  phone1?: string;
  admin: { email: string; username: string; password: string; firstName?: string; lastName?: string };
  license?: LicenseInput;
}) {
  const [emailTaken, usernameTaken] = await Promise.all([
    prisma.user.findUnique({ where: { email: input.admin.email }, select: { id: true } }),
    prisma.user.findUnique({ where: { username: input.admin.username }, select: { id: true } }),
  ]);
  if (emailTaken) throw new AppError(409, 'البريد الإلكتروني للمدير مستخدم بالفعل');
  if (usernameTaken) throw new AppError(409, 'اسم المستخدم للمدير مستخدم بالفعل');

  const company = await companyService.createCompany({
    arabicName: input.arabicName,
    englishName: input.englishName,
    phone1: input.phone1,
  });
  if (input.contactEmail) {
    await prisma.company.update({ where: { id: company.id }, data: { contactEmail: input.contactEmail } });
  }
  const admin = await createTenantUser({ companyId: company.id, ...input.admin, isAdmin: true });
  const license = input.license ? await setCompanyLicense(company.id, input.license) : serializeLicense(null);
  return { company: { id: company.id, arabicName: company.arabicName }, admin, license };
}

export const ALL_LICENSE_MODULES = LICENSE_MODULE_CODES;
