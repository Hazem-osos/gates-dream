import prisma from '../../../shared/database/prisma';
import { logger } from '../../../shared/logger';

export interface ActivityLogQueryOptions {
  page?: number;
  limit?: number;
  kind?: string;
  subjectType?: string;
  subjectId?: string;
  severity?: string;
  actorId?: string;
  fromDate?: Date;
  toDate?: Date;
  reason?: string;
}

export class ActivityLogService {
  /**
   * List activity logs with pagination and filters
   */
  async listActivityLogs(tenantId: string, options: ActivityLogQueryOptions = {}) {
    try {
      const page = options.page || 1;
      const limit = Math.min(options.limit || 50, 100); // Max 100 per page
      const skip = (page - 1) * limit;

      const where: any = {
        tenantId,
      };

      if (options.kind) {
        where.kind = options.kind;
      }

      if (options.subjectType) {
        where.subjectType = options.subjectType;
      }

      if (options.subjectId) {
        where.subjectId = options.subjectId;
      }

      if (options.severity) {
        where.severity = options.severity;
      }

      if (options.actorId) {
        where.actorId = options.actorId;
      }

      if (options.reason) {
        where.reason = { contains: options.reason };
      }

      if (options.fromDate || options.toDate) {
        where.at = {};
        if (options.fromDate) where.at.gte = options.fromDate;
        if (options.toDate) where.at.lte = options.toDate;
      }

      const [logs, total] = await Promise.all([
        prisma.activityLog.findMany({
          where,
          skip,
          take: limit,
          orderBy: { at: 'desc' },
        }),
        prisma.activityLog.count({ where }),
      ]);

      return {
        logs,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      };
    } catch (error) {
      logger.error({ error, tenantId, options }, 'Error listing activity logs');
      throw error;
    }
  }

  /**
   * Get activity log by ID
   */
  async getActivityLogById(tenantId: string, id: string) {
    try {
      const log = await prisma.activityLog.findFirst({
        where: {
          id,
          tenantId,
        },
      });

      if (!log) {
        throw new Error('Activity log not found');
      }

      return log;
    } catch (error) {
      logger.error({ error, tenantId, id }, 'Error getting activity log');
      throw error;
    }
  }

  /**
   * Get activity logs by kind (e.g., 'security', 'user-action', etc.)
   */
  async getActivityLogsByKind(tenantId: string, kind: string, options: Omit<ActivityLogQueryOptions, 'kind'> = {}) {
    return this.listActivityLogs(tenantId, {
      ...options,
      kind,
    });
  }

  /**
   * Get activity logs by subject (e.g., 'user', 'invoice', etc.)
   */
  async getActivityLogsBySubject(tenantId: string, subjectType: string, subjectId: string, options: Omit<ActivityLogQueryOptions, 'subjectType' | 'subjectId'> = {}) {
    return this.listActivityLogs(tenantId, {
      ...options,
      subjectType,
      subjectId,
    });
  }

  /**
   * Get activity logs by actor (user)
   */
  async getUserActivityLogs(tenantId: string, actorId: string, options: Omit<ActivityLogQueryOptions, 'actorId'> = {}) {
    return this.listActivityLogs(tenantId, {
      ...options,
      actorId,
    });
  }
}

export const activityLogService = new ActivityLogService();

