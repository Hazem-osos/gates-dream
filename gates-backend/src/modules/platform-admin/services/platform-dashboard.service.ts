import prisma from '../../../shared/database/prisma';
import { getPlatformSettings } from './platform-settings.service';
import { activityDayDate, activityDayKey } from './user-activity-tracker';

const DAY_MS = 24 * 60 * 60 * 1000;

function sinceDays(n: number): Date {
  return activityDayDate(activityDayKey(new Date(Date.now() - n * DAY_MS)));
}

export async function getPlatformDashboard() {
  const now = new Date();
  const in30 = new Date(now.getTime() + 30 * DAY_MS);
  const today = sinceDays(0);
  const since7 = sinceDays(6);
  const since14 = sinceDays(13);
  const startOfToday = new Date(now.getTime() - 24 * 60 * 60 * 1000);

  const [
    companiesTotal,
    companiesActive,
    companiesNew30,
    usersTotal,
    usersActive,
    loginsLast24h,
    licensed,
    licSuspended,
    licTrial,
    licExpired,
    licExpiring,
    aiDisabledCompanies,
    aiTokens,
    activeTodayRows,
    active7Rows,
    dailySeries,
    topCompanies,
    recentAudit,
    settings,
  ] = await Promise.all([
    prisma.company.count({ where: { deletedAt: null } }),
    prisma.company.count({ where: { deletedAt: null, isActive: true } }),
    prisma.company.count({ where: { deletedAt: null, createdAt: { gte: new Date(now.getTime() - 30 * DAY_MS) } } }),
    prisma.user.count(),
    prisma.user.count({ where: { isActive: true } }),
    prisma.user.count({ where: { lastLoginAt: { gte: startOfToday } } }),
    prisma.tenantSubscription.count(),
    prisma.tenantSubscription.count({ where: { status: 'SUSPENDED' } }),
    prisma.tenantSubscription.count({ where: { status: 'TRIAL' } }),
    prisma.tenantSubscription.count({
      where: {
        OR: [
          { status: 'EXPIRED' },
          { planType: 'SUBSCRIPTION', status: { in: ['ACTIVE', 'TRIAL'] }, expiryDate: { lt: now } },
        ],
      },
    }),
    prisma.tenantSubscription.count({
      where: { planType: 'SUBSCRIPTION', status: { in: ['ACTIVE', 'TRIAL'] }, expiryDate: { gte: now, lte: in30 } },
    }),
    prisma.company.count({ where: { deletedAt: null, aiEnabled: false } }),
    prisma.company.aggregate({ where: { deletedAt: null }, _sum: { aiTokensUsedThisMonth: true } }),
    prisma.userActivityDay.count({ where: { day: today } }),
    prisma.userActivityDay.groupBy({ by: ['userId'], where: { day: { gte: since7 } } }),
    prisma.userActivityDay.groupBy({
      by: ['day'],
      where: { day: { gte: since14 } },
      _count: { _all: true },
      _sum: { activeMinutes: true },
      orderBy: { day: 'asc' },
    }),
    prisma.userActivityDay.groupBy({
      by: ['companyId'],
      where: { day: { gte: since7 } },
      _sum: { activeMinutes: true },
      orderBy: { _sum: { activeMinutes: 'desc' } },
      take: 5,
    }),
    prisma.platformAuditLog.findMany({ orderBy: { at: 'desc' }, take: 8 }),
    getPlatformSettings(),
  ]);

  const topIds = topCompanies.map((t) => t.companyId);
  const names = topIds.length
    ? await prisma.company.findMany({ where: { id: { in: topIds } }, select: { id: true, arabicName: true } })
    : [];
  const nameById = new Map(names.map((n) => [n.id, n.arabicName]));

  return {
    companies: { total: companiesTotal, active: companiesActive, inactive: companiesTotal - companiesActive, newLast30Days: companiesNew30 },
    users: {
      total: usersTotal,
      active: usersActive,
      inactive: usersTotal - usersActive,
      activeToday: activeTodayRows,
      activeLast7Days: active7Rows.length,
      loginsLast24h,
    },
    licenses: {
      licensed,
      unlicensed: Math.max(0, companiesTotal - licensed),
      suspended: licSuspended,
      trial: licTrial,
      expired: licExpired,
      expiringIn30Days: licExpiring,
    },
    ai: {
      platformEnabled: settings.aiEnabled,
      companiesDisabled: aiDisabledCompanies,
      tokensUsedThisMonth: aiTokens._sum.aiTokensUsedThisMonth ?? 0,
    },
    maintenance: settings.maintenance,
    activitySeries: dailySeries.map((d) => ({
      day: d.day,
      activeUsers: d._count._all,
      activeMinutes: d._sum.activeMinutes ?? 0,
    })),
    topCompanies: topCompanies.map((t) => ({
      companyId: t.companyId,
      arabicName: nameById.get(t.companyId) ?? '—',
      activeMinutes: t._sum.activeMinutes ?? 0,
    })),
    recentAudit,
  };
}
