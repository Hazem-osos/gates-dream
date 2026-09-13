import { Request, Response } from 'express';
import { logger } from '../logger';
import prisma from '../database/prisma';

/**
 * Security Audit Utilities
 * Tracks and audits security-related events
 */

export interface SecurityEvent {
  type: 'authentication' | 'authorization' | 'data_access' | 'configuration_change';
  severity: 'low' | 'medium' | 'high' | 'critical';
  userId?: string;
  tenantId?: string;
  resource?: string;
  action?: string;
  ipAddress?: string;
  userAgent?: string;
  details?: Record<string, any>;
}

export class SecurityAuditor {
  /**
   * Log security event
   */
  async logEvent(event: SecurityEvent): Promise<void> {
    try {
      logger.warn(
        {
          securityEvent: true,
          type: event.type,
          severity: event.severity,
          userId: event.userId,
          tenantId: event.tenantId,
          resource: event.resource,
          action: event.action,
          ipAddress: event.ipAddress,
          userAgent: event.userAgent,
          details: event.details,
        },
        `Security event: ${event.type}`
      );

      // In production, you might want to store these in a dedicated security_events table
      // For now, we log them via the activity log
      if (event.userId && event.tenantId) {
        await prisma.activityLog.create({
          data: {
            tenantId: event.tenantId,
            actorId: event.userId,
            kind: 'security',
            subjectType: event.resource ?? 'security',
            subjectId: event.action ?? event.type,
            severity: event.severity,
            reason: `Security event: ${event.type}`,
            metadata: {
              type: event.type,
              resource: event.resource,
              action: event.action,
              ipAddress: event.ipAddress,
              userAgent: event.userAgent,
              ...event.details,
            },
          },
        });
      }
    } catch (error) {
      logger.error({ error, event }, 'Failed to log security event');
    }
  }

  /**
   * Audit failed authentication attempts
   */
  async auditFailedAuth(
    identifier: string,
    reason: string,
    ipAddress?: string,
    userAgent?: string
  ): Promise<void> {
    await this.logEvent({
      type: 'authentication',
      severity: 'medium',
      ipAddress,
      userAgent,
      details: {
        identifier,
        reason,
      },
    });
  }

  /**
   * Audit authorization failures
   */
  async auditAuthzFailure(
    userId: string,
    tenantId: string,
    resource: string,
    action: string,
    ipAddress?: string,
    userAgent?: string
  ): Promise<void> {
    await this.logEvent({
      type: 'authorization',
      severity: 'high',
      userId,
      tenantId,
      resource,
      action,
      ipAddress,
      userAgent,
    });
  }

  /**
   * Audit sensitive data access
   */
  async auditDataAccess(
    userId: string,
    tenantId: string,
    resource: string,
    action: string,
    recordId?: string,
    ipAddress?: string,
    userAgent?: string
  ): Promise<void> {
    await this.logEvent({
      type: 'data_access',
      severity: 'low',
      userId,
      tenantId,
      resource,
      action,
      ipAddress,
      userAgent,
      details: {
        recordId,
      },
    });
  }

  /**
   * Audit configuration changes
   */
  async auditConfigChange(
    userId: string,
    tenantId: string,
    configType: string,
    changes: Record<string, any>,
    ipAddress?: string,
    userAgent?: string
  ): Promise<void> {
    await this.logEvent({
      type: 'configuration_change',
      severity: 'high',
      userId,
      tenantId,
      resource: configType,
      action: 'update',
      ipAddress,
      userAgent,
      details: {
        changes,
      },
    });
  }

  /**
   * Get security events for a tenant
   */
  async getSecurityEvents(
    tenantId: string,
    options: {
      type?: SecurityEvent['type'];
      severity?: SecurityEvent['severity'];
      limit?: number;
      offset?: number;
    } = {}
  ): Promise<any[]> {
    const { type, severity, limit = 100, offset = 0 } = options;

    const where: any = {
      tenantId,
      kind: 'security',
    };

    if (type) {
      where.metadata = {
        path: ['type'],
        equals: type,
      };
    }

    return prisma.activityLog.findMany({
      where,
      take: limit,
      skip: offset,
      orderBy: {
        at: 'desc',
      },
    });
  }
}

export const securityAuditor = new SecurityAuditor();

/**
 * Middleware to extract request metadata for security auditing
 */
export function extractSecurityContext(req: Request): {
  ipAddress?: string;
  userAgent?: string;
} {
  return {
    ipAddress:
      (req.headers['x-forwarded-for'] as string)?.split(',')[0] ||
      (req.headers['x-real-ip'] as string) ||
      req.ip ||
      req.socket.remoteAddress,
    userAgent: req.headers['user-agent'],
  };
}
