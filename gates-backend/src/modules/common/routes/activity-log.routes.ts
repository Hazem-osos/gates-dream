import { Router, Response } from 'express';
import { validate } from '../../../shared/middleware/validate';
import { authenticate } from '../../../shared/middleware/auth.middleware';
import { authorize } from '../../../shared/middleware/authorize.middleware';
import { setTenantContext } from '../../../shared/middleware/tenant.middleware';
import { activityLogQuerySchema } from '../schemas/activity-log.schema';
import { activityLogService } from '../services/activity-log.service';
import { logger } from '../../../shared/logger';
import { AuthRequest } from '../../../shared/auth/types';

const router = Router();

router.use(authenticate);
router.use(setTenantContext);

/**
 * GET /api/v1/activity-logs
 * List activity logs with filters
 */
router.get(
  '/',
  authorize({ resource: 'activity-log', action: 'view' }),
  validate({ query: activityLogQuerySchema }),
  async (req: AuthRequest, res: Response) => {
    try {
      const tenantId = req.tenantId || req.companyId;
      if (!tenantId) {
        return void res.status(400).json({
          status: 'error',
          message: 'Tenant ID is required',
        });
      }

      const result = await activityLogService.listActivityLogs(tenantId, {
        page: req.query.page as number | undefined,
        limit: req.query.limit as number | undefined,
        kind: req.query.kind as string | undefined,
        subjectType: req.query.subjectType as string | undefined,
        subjectId: req.query.subjectId as string | undefined,
        severity: req.query.severity as string | undefined,
        actorId: req.query.actorId as string | undefined,
        fromDate: req.query.fromDate ? new Date(req.query.fromDate as string) : undefined,
        toDate: req.query.toDate ? new Date(req.query.toDate as string) : undefined,
      });

      return void res.json({
        status: 'success',
        data: result.logs,
        pagination: result.pagination,
      });
    } catch (error) {
      logger.error({ error }, 'Error listing activity logs');
      return void res.status(500).json({
        status: 'error',
        message: error instanceof Error ? error.message : 'Failed to list activity logs',
      });
    }
  }
);

/**
 * GET /api/v1/activity-logs/:id
 * Get activity log by ID
 */
router.get(
  '/:id',
  authorize({ resource: 'activity-log', action: 'view' }),
  async (req: AuthRequest, res: Response) => {
    try {
      const tenantId = req.tenantId || req.companyId;
      if (!tenantId) {
        return void res.status(400).json({
          status: 'error',
          message: 'Tenant ID is required',
        });
      }

      const log = await activityLogService.getActivityLogById(tenantId, req.params.id);

      return void res.json({
        status: 'success',
        data: log,
      });
    } catch (error) {
      logger.error({ error }, 'Error getting activity log');
      const statusCode = error instanceof Error && error.message === 'Activity log not found' ? 404 : 500;
      return void res.status(statusCode).json({
        status: 'error',
        message: error instanceof Error ? error.message : 'Failed to get activity log',
      });
    }
  }
);

/**
 * GET /api/v1/activity-logs/kind/:kind
 * Get activity logs by kind
 */
router.get(
  '/kind/:kind',
  authorize({ resource: 'activity-log', action: 'view' }),
  validate({ query: activityLogQuerySchema }),
  async (req: AuthRequest, res: Response) => {
    try {
      const tenantId = req.tenantId || req.companyId;
      if (!tenantId) {
        return void res.status(400).json({
          status: 'error',
          message: 'Tenant ID is required',
        });
      }

      const result = await activityLogService.getActivityLogsByKind(tenantId, req.params.kind, {
        page: req.query.page as number | undefined,
        limit: req.query.limit as number | undefined,
        subjectType: req.query.subjectType as string | undefined,
        subjectId: req.query.subjectId as string | undefined,
        severity: req.query.severity as string | undefined,
        actorId: req.query.actorId as string | undefined,
        fromDate: req.query.fromDate ? new Date(req.query.fromDate as string) : undefined,
        toDate: req.query.toDate ? new Date(req.query.toDate as string) : undefined,
      });

      return void res.json({
        status: 'success',
        data: result.logs,
        pagination: result.pagination,
      });
    } catch (error) {
      logger.error({ error }, 'Error listing activity logs by kind');
      return void res.status(500).json({
        status: 'error',
        message: error instanceof Error ? error.message : 'Failed to list activity logs',
      });
    }
  }
);

/**
 * GET /api/v1/activity-logs/subject/:subjectType/:subjectId
 * Get activity logs for a specific subject
 */
router.get(
  '/subject/:subjectType/:subjectId',
  authorize({ resource: 'activity-log', action: 'view' }),
  validate({ query: activityLogQuerySchema }),
  async (req: AuthRequest, res: Response) => {
    try {
      const tenantId = req.tenantId || req.companyId;
      if (!tenantId) {
        return void res.status(400).json({
          status: 'error',
          message: 'Tenant ID is required',
        });
      }

      const result = await activityLogService.getActivityLogsBySubject(
        tenantId,
        req.params.subjectType,
        req.params.subjectId,
        {
          page: req.query.page as number | undefined,
          limit: req.query.limit as number | undefined,
          kind: req.query.kind as string | undefined,
          severity: req.query.severity as string | undefined,
          actorId: req.query.actorId as string | undefined,
          fromDate: req.query.fromDate ? new Date(req.query.fromDate as string) : undefined,
          toDate: req.query.toDate ? new Date(req.query.toDate as string) : undefined,
        }
      );

      return void res.json({
        status: 'success',
        data: result.logs,
        pagination: result.pagination,
      });
    } catch (error) {
      logger.error({ error }, 'Error listing activity logs by subject');
      return void res.status(500).json({
        status: 'error',
        message: error instanceof Error ? error.message : 'Failed to list activity logs',
      });
    }
  }
);

export default router;

