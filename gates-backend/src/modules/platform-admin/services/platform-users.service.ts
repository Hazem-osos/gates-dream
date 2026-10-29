/**
 * Tenant users managed from the platform admin panel (across every company).
 * No tenant context here: every query states its own scope.
 */
import bcrypt from 'bcryptjs';
import type { Prisma } from '@prisma/client';
import prisma from '../../../shared/database/prisma';
import { AppError } from '../../../shared/middleware/error-handler';
import { permanentDelete } from '../../../shared/database/permanent-delete.util';
import { invalidateTenantCache, tenantCacheKeys } from '../../../shared/cache/tenant-metadata-cache';
import { getUserSessions, revokeAllUserSessions } from '../../../shared/auth/session-manager';
import { redisClient } from '../../../shared/cache/redis';
import { assertWithinLicenseLimit, invalidateUserAccess } from './platform-access.service';
import { activityDayDate, activityDayKey } from './user-activity-tracker';

const DAY_MS = 24 * 60 * 60 * 1000;
/** Same rows the "admin" role definition grants (role-definitions.service.ts). */
const GRANT_ALL_ACTIONS = ['view', 'edit', 'delete', 'approve', 'post'] as const;

function sinceDays(n: number): Date {
  return activityDayDate(activityDayKey(new Date(Date.now() - n * DAY_MS)));
}

async function setGrantAll(userId: string, companyId: string, isAdmin: boolean): Promise<void> {
  if (isAdmin) {
    const existing = await prisma.userPermission.findMany({
      where: { userId, companyId, resource: '*', module: null, branchId: null },
      select: { action: true, allow: true, id: true },
    });
    const have = new Map(existing.map((p) => [p.action, p]));
    for (const action of GRANT_ALL_ACTIONS) {
      const row = have.get(action);
      if (!row) {
        await prisma.userPermission.create({ data: { userId, companyId, resource: '*', action, allow: true } });
      } else if (!row.allow) {
        await prisma.userPermission.update({ where: { id: row.id }, data: { allow: true } });
      }
    }
  } else {
    await prisma.userPermission.deleteMany({ where: { userId, companyId, resource: '*' } });
  }
  await invalidateTenantCache(tenantCacheKeys.userPerms(companyId, userId));
}

async function afterUserChange(userId: string, opts: { revokeSessions?: boolean } = {}): Promise<void> {
  await invalidateUserAccess(userId);
  if (opts.revokeSessions) await revokeAllUserSessions(userId);
}

export async function createTenantUser(input: {
  companyId: string;
  email: string;
  username: string;
  password: string;
  firstName?: string | null;
  lastName?: string | null;
  phone?: string | null;
  isAdmin?: boolean;
}) {
  const company = await prisma.company.findUnique({ where: { id: input.companyId }, select: { id: true } });
  if (!company) throw new AppError(404, 'الشركة غير موجودة');
  await assertWithinLicenseLimit(input.companyId, 'users');
  const email = input.email.trim();
  const username = input.username.trim();
  const [emailTaken, usernameTaken] = await Promise.all([
    prisma.user.findUnique({ where: { email }, select: { id: true } }),
    prisma.user.findUnique({ where: { username }, select: { id: true } }),
  ]);
  if (emailTaken) throw new AppError(409, 'البريد الإلكتروني مستخدم بالفعل');
  if (usernameTaken) throw new AppError(409, 'اسم المستخدم مستخدم بالفعل');

  const user = await prisma.user.create({
    data: {
      companyId: input.companyId,
      email,
      username,
      passwordHash: await bcrypt.hash(input.password, 10),
      firstName: input.firstName ?? null,
      lastName: input.lastName ?? null,
      phone: input.phone ?? null,
      isActive: true,
    },
    select: { id: true, email: true, username: true, companyId: true },
  });
  if (input.isAdmin) await setGrantAll(user.id, input.companyId, true);
  return { ...user, isAdmin: Boolean(input.isAdmin) };
}

export async function listTenantUsers(filter: {
  page: number;
  pageSize: number;
  search?: string;
  companyId?: string;
  status?: 'all' | 'active' | 'inactive';
}) {
  const search = filter.search?.trim();
  const where: Prisma.UserWhereInput = {
    ...(filter.companyId ? { companyId: filter.companyId } : {}),
    ...(filter.status === 'active' ? { isActive: true } : {}),
    ...(filter.status === 'inactive' ? { isActive: false } : {}),
    ...(search
      ? {
          OR: [
            { email: { contains: search } },
            { username: { contains: search } },
            { firstName: { contains: search } },
            { lastName: { contains: search } },
            { phone: { contains: search } },
          ],
        }
      : {}),
  };
  const [total, users] = await Promise.all([
    prisma.user.count({ where }),
    prisma.user.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (filter.page - 1) * filter.pageSize,
      take: filter.pageSize,
      select: {
        id: true,
        email: true,
        username: true,
        firstName: true,
        lastName: true,
        phone: true,
        isActive: true,
        lastLoginAt: true,
        loginCount: true,
        createdAt: true,
        company: { select: { id: true, arabicName: true, isActive: true } },
      },
    }),
  ]);

  const ids = users.map((u) => u.id);
  const [admins, activity] = ids.length
    ? await Promise.all([
        prisma.userPermission.findMany({
          where: { userId: { in: ids }, resource: '*', allow: true },
          select: { userId: true },
          distinct: ['userId'],
        }),
        prisma.userActivityDay.groupBy({
          by: ['userId'],
          where: { userId: { in: ids }, day: { gte: sinceDays(29) } },
          _sum: { activeMinutes: true },
          _count: { _all: true },
          _max: { lastSeenAt: true },
        }),
      ])
    : [[], []];
  const adminSet = new Set(admins.map((a) => a.userId));
  const act = new Map(activity.map((a) => [a.userId, a]));

  return {
    total,
    page: filter.page,
    pageSize: filter.pageSize,
    rows: users.map((u) => ({
      ...u,
      isAdmin: adminSet.has(u.id),
      activeMinutesLast30Days: act.get(u.id)?._sum.activeMinutes ?? 0,
      activeDaysLast30Days: act.get(u.id)?._count._all ?? 0,
      lastSeenAt: act.get(u.id)?._max.lastSeenAt ?? null,
    })),
  };
}

export async function getTenantUserDetail(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      username: true,
      firstName: true,
      lastName: true,
      phone: true,
      preferredLanguage: true,
      isActive: true,
      lastLoginAt: true,
      loginCount: true,
      createdAt: true,
      updatedAt: true,
      company: { select: { id: true, arabicName: true, isActive: true } },
      groupMemberships: { select: { userGroup: { select: { id: true, arabicName: true } } } },
      branchPermissions: { select: { branch: { select: { id: true, arabicName: true } } } },
    },
  });
  if (!user) throw new AppError(404, 'المستخدم غير موجود');

  const [grantAll, permissionCount, activity, aiConversations, sessions] = await Promise.all([
    prisma.userPermission.count({ where: { userId, resource: '*', allow: true } }),
    prisma.userPermission.count({ where: { userId, allow: true } }),
    prisma.userActivityDay.findMany({
      where: { userId, day: { gte: sinceDays(29) } },
      orderBy: { day: 'asc' },
      select: { day: true, activeMinutes: true, requestCount: true, firstSeenAt: true, lastSeenAt: true },
    }),
    prisma.aiConversation.count({ where: { userId } }),
    getUserSessions(userId),
  ]);

  const totalMinutes = activity.reduce((s, d) => s + d.activeMinutes, 0);
  return {
    ...user,
    groups: user.groupMemberships.map((g) => g.userGroup),
    branches: user.branchPermissions.map((b) => b.branch),
    isAdmin: grantAll > 0,
    permissionCount,
    aiConversations,
    activity: {
      days: activity,
      activeDaysLast30: activity.length,
      activeMinutesLast30: totalMinutes,
      averageMinutesPerActiveDay: activity.length ? Math.round(totalMinutes / activity.length) : 0,
      lastSeenAt: activity.length ? activity[activity.length - 1]!.lastSeenAt : null,
    },
    sessions: {
      tracked: redisClient.isReady(),
      items: sessions.map((s) => ({
        ipAddress: s.ipAddress ?? null,
        userAgent: s.userAgent ?? null,
        createdAt: s.createdAt,
        lastActivityAt: s.lastActivityAt,
      })),
    },
  };
}

export async function updateTenantUser(
  userId: string,
  data: {
    email?: string;
    username?: string;
    firstName?: string | null;
    lastName?: string | null;
    phone?: string | null;
    isActive?: boolean;
    isAdmin?: boolean;
  }
) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, companyId: true, isActive: true },
  });
  if (!user) throw new AppError(404, 'المستخدم غير موجود');
  if (data.isActive === true && !user.isActive) await assertWithinLicenseLimit(user.companyId, 'users');
  if (data.email) {
    const taken = await prisma.user.findFirst({ where: { email: data.email, id: { not: userId } }, select: { id: true } });
    if (taken) throw new AppError(409, 'البريد الإلكتروني مستخدم بالفعل');
  }
  if (data.username) {
    const taken = await prisma.user.findFirst({ where: { username: data.username, id: { not: userId } }, select: { id: true } });
    if (taken) throw new AppError(409, 'اسم المستخدم مستخدم بالفعل');
  }
  const { isAdmin, ...fields } = data;
  await prisma.user.update({ where: { id: userId }, data: fields });
  if (typeof isAdmin === 'boolean') await setGrantAll(userId, user.companyId, isAdmin);
  await afterUserChange(userId, { revokeSessions: data.isActive === false });
  return getTenantUserDetail(userId);
}

export async function resetTenantUserPassword(userId: string, password: string) {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { id: true } });
  if (!user) throw new AppError(404, 'المستخدم غير موجود');
  await prisma.user.update({ where: { id: userId }, data: { passwordHash: await bcrypt.hash(password, 10) } });
  await afterUserChange(userId, { revokeSessions: true });
}

export async function forceLogoutTenantUser(userId: string) {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { id: true } });
  if (!user) throw new AppError(404, 'المستخدم غير موجود');
  const before = (await getUserSessions(userId)).length;
  await revokeAllUserSessions(userId);
  return { revoked: before, sessionsTracked: redisClient.isReady() };
}

export async function deleteTenantUser(userId: string) {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { id: true, companyId: true, email: true } });
  if (!user) throw new AppError(404, 'المستخدم غير موجود');
  await permanentDelete('المستخدم', () => prisma.user.delete({ where: { id: userId } }));
  await afterUserChange(userId, { revokeSessions: true });
  await invalidateTenantCache(tenantCacheKeys.userPerms(user.companyId, userId));
  return { id: userId, companyId: user.companyId, email: user.email };
}
