import { Router, Response } from 'express';
import { validate } from '../../../shared/middleware/validate';
import { authenticate } from '../../../shared/middleware/auth.middleware';
import { authorize } from '../../../shared/middleware/authorize.middleware';
import { setTenantContext } from '../../../shared/middleware/tenant.middleware';
import { auditLogQuerySchema } from '../schemas/audit-log.schema';
import { auditLogService } from '../services/audit-log.service';
import { logger } from '../../../shared/logger';
import { AuthRequest } from '../../../shared/auth/types';

const router = Router();

router.use(authenticate);
router.use(setTenantContext);

/**
 * GET /api/v1/audit-logs
 * List audit logs with filters
 */
router.get(
  '/',
  authorize({ resource: 'audit-log', action: 'view' }),
  validate({ query: auditLogQuerySchema }),
  async (req: AuthRequest, res: Response) => {
    try {
      const tenantId = req.tenantId || req.companyId;
      if (!tenantId) {
        return void res.status(400).json({
          status: 'error',
          message: 'Tenant ID is required',
        });
      }

      const result = await auditLogService.listAuditLogs(tenantId, {
        page: req.query.page as number | undefined,
        limit: req.query.limit as number | undefined,
        tableName: req.query.tableName as string | undefined,
        action: req.query.action as string | undefined,
        userId: req.query.userId as string | undefined,
        fromDate: req.query.fromDate ? new Date(req.query.fromDate as string) : undefined,
        toDate: req.query.toDate ? new Date(req.query.toDate as string) : undefined,
        rowId: req.query.rowId as string | undefined,
      });

      return void res.json({
        status: 'success',
        data: result.logs,
        pagination: result.pagination,
      });
    } catch (error) {
      logger.error({ error }, 'Error listing audit logs');
      return void res.status(500).json({
        status: 'error',
        message: error instanceof Error ? error.message : 'Failed to list audit logs',
      });
    }
  }
);

/**
 * GET /api/v1/audit-logs/:id
 * Get audit log by ID
 */
router.get(
  '/:id',
  authorize({ resource: 'audit-log', action: 'view' }),
  async (req: AuthRequest, res: Response) => {
    try {
      const tenantId = req.tenantId || req.companyId;
      if (!tenantId) {
        return void res.status(400).json({
          status: 'error',
          message: 'Tenant ID is required',
        });
      }

      const log = await auditLogService.getAuditLogById(tenantId, req.params.id);

      return void res.json({
        status: 'success',
        data: log,
      });
    } catch (error) {
      logger.error({ error }, 'Error getting audit log');
      const statusCode = error instanceof Error && error.message === 'Audit log not found' ? 404 : 500;
      return void res.status(statusCode).json({
        status: 'error',
        message: error instanceof Error ? error.message : 'Failed to get audit log',
      });
    }
  }
);

/**
 * GET /api/v1/audit-logs/table/:tableName/row/:rowId
 * Get audit trail for a specific row
 */
router.get(
  '/table/:tableName/row/:rowId',
  authorize({ resource: 'audit-log', action: 'view' }),
  async (req: AuthRequest, res: Response) => {
    try {
      const tenantId = req.tenantId || req.companyId;
      if (!tenantId) {
        return void res.status(400).json({
          status: 'error',
          message: 'Tenant ID is required',
        });
      }

      const logs = await auditLogService.getRowAuditTrail(
        tenantId,
        req.params.tableName,
        req.params.rowId
      );

      return void res.json({
        status: 'success',
        data: logs,
      });
    } catch (error) {
      logger.error({ error }, 'Error getting row audit trail');
      return void res.status(500).json({
        status: 'error',
        message: error instanceof Error ? error.message : 'Failed to get row audit trail',
      });
    }
  }
);

export default router;

