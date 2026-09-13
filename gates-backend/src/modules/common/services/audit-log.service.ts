import { Prisma } from '@prisma/client';
import prisma from '../../../shared/database/prisma';
import { logger } from '../../../shared/logger';

export interface AuditLogQueryOptions {
  page?: number;
  limit?: number;
  tableName?: string;
  action?: string;
  userId?: string;
  fromDate?: Date;
  toDate?: Date;
  rowId?: string;
}

/**
 * C12 fix: the old `AuditLog`/`audit_logs` model this service used to read
 * from was never written by any application code (verified: zero
 * `auditLog.create` call sites) — it presented a tamper-evident hash-chain
 * audit API that silently contained no data. This module now reads from
 * `ActivityLog` (`activity_logs`) instead, which *is* actively written —
 * both by `documentAuditService` (financial document/journal-entry
 * lifecycle events, `kind: 'document-audit'`) and by the security-event
 * logger (`kind: 'security'`, login failures/lockouts). Field names below
 * are translated so every existing caller (routes, the "تتبع المستخدمين"
 * frontend screen) keeps working against the same response shape with no
 * changes on their end.
 *
 * Field mapping: tenantId↔tenantId, userId→actorId, tableName→subjectType,
 * rowId→subjectId, action→metadata.action (JSON path filter), at↔at.
 */
export class AuditLogService {
  private toWhere(tenantId: string, options: AuditLogQueryOptions): Prisma.ActivityLogWhereInput {
    const where: Prisma.ActivityLogWhereInput = { tenantId };

    if (options.tableName) {
      where.subjectType = options.tableName;
    }

    if (options.userId) {
      where.actorId = options.userId;
    }

    if (options.rowId) {
      where.subjectId = options.rowId;
    }

    if (options.action) {
      // MySQL's JSON filter takes a plain string path (unlike Postgres's
      // `string[]`) using MySQL's own JSON path syntax, which requires the
      // leading `$.` — see the generated `JsonFilterBase.path` type.
      where.metadata = { path: '$.action', equals: options.action };
    }

    if (options.fromDate || options.toDate) {
      where.at = {};
      if (options.fromDate) where.at.gte = options.fromDate;
      if (options.toDate) where.at.lte = options.toDate;
    }

    return where;
  }

  private toResponseRow(log: {
    id: string;
    subjectType: string;
    subjectId: string;
    actorId: string;
    at: Date;
    requestId: string | null;
    ip: string | null;
    userAgent: string | null;
    metadata: unknown;
  }) {
    const metadata = (log.metadata ?? {}) as Record<string, unknown>;
    return {
      id: log.id,
      tableName: log.subjectType,
      rowId: log.subjectId,
      action: (metadata.action as string | undefined) ?? null,
      at: log.at,
      by: log.actorId,
      requestId: log.requestId,
      ip: log.ip,
      userAgent: log.userAgent,
      oldValues: null,
      newValues: metadata,
    };
  }

  /**
   * List audit logs with pagination and filters
   */
  async listAuditLogs(tenantId: string, options: AuditLogQueryOptions = {}) {
    try {
      const page = options.page || 1;
      const limit = Math.min(options.limit || 50, 100); // Max 100 per page
      const skip = (page - 1) * limit;
      const where = this.toWhere(tenantId, options);

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
        logs: logs.map((log) => this.toResponseRow(log)),
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      };
    } catch (error) {
      logger.error({ error, tenantId, options }, 'Error listing audit logs');
      throw error;
    }
  }

  /**
   * Get audit log by ID
   */
  async getAuditLogById(tenantId: string, id: string) {
    try {
      const log = await prisma.activityLog.findFirst({
        where: {
          id,
          tenantId,
        },
      });

      if (!log) {
        throw new Error('Audit log not found');
      }

      return this.toResponseRow(log);
    } catch (error) {
      logger.error({ error, tenantId, id }, 'Error getting audit log');
      throw error;
    }
  }

  /**
   * Get audit trail for a specific row
   */
  async getRowAuditTrail(tenantId: string, tableName: string, rowId: string) {
    try {
      const logs = await prisma.activityLog.findMany({
        where: {
          tenantId,
          subjectType: tableName,
          subjectId: rowId,
        },
        orderBy: { at: 'asc' },
      });

      return logs.map((log) => this.toResponseRow(log));
    } catch (error) {
      logger.error({ error, tenantId, tableName, rowId }, 'Error getting row audit trail');
      throw error;
    }
  }

  /**
   * Get audit logs by table name
   */
  async getTableAuditLogs(tenantId: string, tableName: string, options: Omit<AuditLogQueryOptions, 'tableName'> = {}) {
    return this.listAuditLogs(tenantId, {
      ...options,
      tableName,
    });
  }

  /**
   * Get audit logs by user
   */
  async getUserAuditLogs(tenantId: string, userId: string, options: Omit<AuditLogQueryOptions, 'userId'> = {}) {
    return this.listAuditLogs(tenantId, {
      ...options,
      userId,
    });
  }
}

export const auditLogService = new AuditLogService();
