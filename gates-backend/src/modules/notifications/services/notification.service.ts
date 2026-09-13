import type { NotificationCategory, NotificationSeverity } from '@prisma/client';
import prisma from '../../../shared/database/prisma';
import { logger } from '../../../shared/logger';
import {
  allowedCategoriesForRoles,
  canReceiveNotification,
  normalizeCallerRoles,
  type SentinelRole,
} from '../../ai/sentinel/notification-rbac';

export type UnifiedNotification = {
  id: string;
  source: 'ai' | 'system';
  title: string;
  message: string;
  titleAr: string;
  messageAr: string;
  type: string;
  category: string | null;
  severity: NotificationSeverity | 'INFO' | 'WARNING' | 'CRITICAL';
  linkUrl: string | null;
  actionUrl: string | null;
  actionLabelAr: string | null;
  isRead: boolean;
  createdAt: Date;
  metadata: unknown;
};

function asStringRoles(roles: unknown): string[] {
  if (!Array.isArray(roles)) return [];
  return roles.filter((role): role is string => typeof role === 'string' && role.trim().length > 0);
}

function aiDelegate() {
  const delegate = (prisma as { aiNotification?: typeof prisma.aiNotification }).aiNotification;
  return delegate && typeof delegate.findMany === 'function' ? delegate : null;
}

async function loadAiNotifications(
  companyId: string,
  userId: string,
  allowedCategories: NotificationCategory[]
) {
  const delegate = aiDelegate();
  if (!delegate || !allowedCategories.length) return [];
  try {
    return await delegate.findMany({
      where: {
        companyId,
        category: { in: allowedCategories },
        OR: [{ userId: null }, { userId }],
      },
      orderBy: { createdAt: 'desc' },
      take: 80,
    });
  } catch (error) {
    logger.warn(
      { err: error, companyId, message: error instanceof Error ? error.message : String(error) },
      'AI notifications query failed; returning system notifications only'
    );
    return [];
  }
}

async function findAiNotification(notificationId: string, companyId: string, userId: string) {
  const delegate = aiDelegate();
  if (!delegate) return null;
  try {
    return await delegate.findFirst({
      where: { id: notificationId, companyId, OR: [{ userId: null }, { userId }] },
    });
  } catch (error) {
    logger.warn(
      { err: error, companyId, message: error instanceof Error ? error.message : String(error) },
      'AI notification lookup failed'
    );
    return null;
  }
}

async function markAiNotificationsRead(
  companyId: string,
  userId: string,
  allowedCategories: NotificationCategory[]
) {
  const delegate = aiDelegate();
  if (!delegate || !allowedCategories.length) return { count: 0 };
  try {
    return await delegate.updateMany({
      where: {
        companyId,
        isRead: false,
        category: { in: allowedCategories },
        OR: [{ userId: null }, { userId }],
      },
      data: { isRead: true, readAt: new Date() },
    });
  } catch (error) {
    logger.warn(
      { err: error, companyId, message: error instanceof Error ? error.message : String(error) },
      'AI notifications mark-read failed'
    );
    return { count: 0 };
  }
}

export class NotificationService {
  async listForUser(
    companyId: string,
    userId: string,
    roles: string[] | { page?: number; limit?: number } = [],
    options: { page?: number; limit?: number } = {}
  ) {
    if (!Array.isArray(roles) && roles && typeof roles === 'object') {
      options = roles;
      roles = [];
    }
    const page = options.page ?? 1;
    const limit = Math.min(options.limit ?? 20, 100);
    const callerRoles = normalizeCallerRoles(asStringRoles(roles));
    const allowedCategories = allowedCategoriesForRoles(callerRoles);

    const [aiRows, systemRows] = await Promise.all([
      loadAiNotifications(companyId, userId, allowedCategories),
      prisma.systemNotification.findMany({
        where: {
          companyId,
          type: { not: 'ONBOARDING_TOUR' },
          OR: [{ userId: null }, { userId }],
        },
        orderBy: { createdAt: 'desc' },
        take: 40,
      }),
    ]);

    const visibleAi = aiRows.filter((row) =>
      canReceiveNotification({
        callerRoles,
        callerUserId: userId,
        category: row.category,
        targetRoles: row.targetRoles,
        userId: row.userId,
      })
    );

    const merged: UnifiedNotification[] = [
      ...visibleAi.map((row) => this.fromAi(row)),
      ...systemRows.map((row) => this.fromSystem(row)),
    ].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    const unreadCount = merged.filter((row) => !row.isRead).length;
    const skip = (page - 1) * limit;
    const notifications = merged.slice(skip, skip + limit);

    return {
      notifications,
      unreadCount,
      hasCriticalUnread: merged.some((row) => !row.isRead && row.severity === 'CRITICAL'),
      pagination: {
        page,
        limit,
        total: merged.length,
        totalPages: Math.ceil(merged.length / limit) || 1,
      },
    };
  }

  async markRead(companyId: string, userId: string, roles: string[], notificationId: string) {
    const callerRoles = normalizeCallerRoles(asStringRoles(roles));
    const ai = await findAiNotification(notificationId, companyId, userId);
    if (ai) {
      if (
        !canReceiveNotification({
          callerRoles,
          callerUserId: userId,
          category: ai.category,
          targetRoles: ai.targetRoles,
          userId: ai.userId,
        })
      ) {
        throw new Error('Notification not found');
      }
      const delegate = aiDelegate();
      if (!delegate) throw new Error('Notification not found');
      return delegate.update({
        where: { id: ai.id },
        data: { isRead: true, readAt: new Date() },
      });
    }

    const row = await prisma.systemNotification.findFirst({
      where: {
        id: notificationId,
        companyId,
        OR: [{ userId: null }, { userId }],
      },
    });
    if (!row) throw new Error('Notification not found');
    return prisma.systemNotification.update({
      where: { id: row.id },
      data: { isRead: true },
    });
  }

  async markAllRead(companyId: string, userId: string, roles: string[]) {
    const callerRoles = normalizeCallerRoles(asStringRoles(roles));
    const allowedCategories = allowedCategoriesForRoles(callerRoles);
    const [ai, system] = await Promise.all([
      markAiNotificationsRead(companyId, userId, allowedCategories),
      prisma.systemNotification.updateMany({
        where: {
          companyId,
          isRead: false,
          OR: [{ userId: null }, { userId }],
        },
        data: { isRead: true },
      }),
    ]);
    logger.info({ companyId, userId, ai: ai.count, system: system.count }, 'Notifications marked all read');
    return { updated: ai.count + system.count };
  }

  private fromAi(row: {
    id: string;
    titleAr: string;
    messageAr: string;
    category: NotificationCategory;
    severity: NotificationSeverity;
    actionUrl: string | null;
    actionLabelAr: string | null;
    isRead: boolean;
    createdAt: Date;
    metadata: unknown;
  }): UnifiedNotification {
    return {
      id: row.id,
      source: 'ai',
      title: row.titleAr,
      message: row.messageAr,
      titleAr: row.titleAr,
      messageAr: row.messageAr,
      type: row.severity,
      category: row.category,
      severity: row.severity,
      linkUrl: row.actionUrl,
      actionUrl: row.actionUrl,
      actionLabelAr: row.actionLabelAr,
      isRead: row.isRead,
      createdAt: row.createdAt,
      metadata: row.metadata,
    };
  }

  private fromSystem(row: {
    id: string;
    title: string;
    message: string;
    type: string;
    category: string | null;
    linkUrl: string | null;
    isRead: boolean;
    createdAt: Date;
  }): UnifiedNotification {
    const severity: UnifiedNotification['severity'] =
      row.type === 'ALERT' || row.type === 'CRITICAL'
        ? 'CRITICAL'
        : row.type === 'WARNING'
          ? 'WARNING'
          : 'INFO';
    return {
      id: row.id,
      source: 'system',
      title: row.title,
      message: row.message,
      titleAr: row.title,
      messageAr: row.message,
      type: row.type,
      category: row.category,
      severity,
      linkUrl: row.linkUrl,
      actionUrl: row.linkUrl,
      actionLabelAr: row.linkUrl ? 'فتح' : null,
      isRead: row.isRead,
      createdAt: row.createdAt,
      metadata: null,
    };
  }
}

export const notificationService = new NotificationService();

export function extractRequestRoles(user?: {
  role?: string;
  realm_access?: { roles?: string[] };
  resource_access?: Record<string, { roles?: string[] }>;
}): string[] {
  const roles = new Set<string>();
  if (typeof user?.role === 'string' && user.role) roles.add(user.role);
  for (const role of user?.realm_access?.roles ?? []) {
    if (typeof role === 'string' && role) roles.add(role);
  }
  for (const role of user?.resource_access?.['gates-backend']?.roles ?? []) {
    if (typeof role === 'string' && role) roles.add(role);
  }
  return [...roles];
}

export type { SentinelRole };
