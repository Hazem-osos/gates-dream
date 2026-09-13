import { Request, Response, NextFunction } from 'express';
import { securityAuditor, extractSecurityContext } from '../security/security-audit';

/**
 * Security Audit Middleware
 * Logs security-relevant events for auditing
 */

export function securityAuditMiddleware(req: Request, res: Response, next: NextFunction): void {
  const context = extractSecurityContext(req);
  const userId = (req as any).user?.sub;
  const tenantId = (req as any).tenantId;

  // Audit authorization failures (4xx responses)
  const originalJson = res.json;
  res.json = function (body: any) {
    if (res.statusCode >= 400 && res.statusCode < 500 && userId) {
      if (res.statusCode === 401) {
        securityAuditor.auditFailedAuth(
          userId,
          'Unauthorized access attempt',
          context.ipAddress,
          context.userAgent
        );
      } else if (res.statusCode === 403) {
        securityAuditor.auditAuthzFailure(
          userId,
          tenantId || '',
          req.path,
          req.method,
          context.ipAddress,
          context.userAgent
        );
      }
    }

    return originalJson.call(this, body);
  };

  // Audit sensitive data access
  if (userId && tenantId) {
    const sensitivePaths = [
      '/api/v1/hr/employees',
      '/api/v1/accounting/customers',
      '/api/v1/accounting/suppliers',
    ];

    if (sensitivePaths.some((path) => req.path.includes(path))) {
      securityAuditor.auditDataAccess(
        userId,
        tenantId,
        req.path,
        req.method,
        undefined,
        context.ipAddress,
        context.userAgent
      );
    }
  }

  next();
}

