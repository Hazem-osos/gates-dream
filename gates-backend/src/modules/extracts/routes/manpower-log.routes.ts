import { Router, Response } from 'express';
import { validate } from '../../../shared/middleware/validate';
import { authenticate } from '../../../shared/middleware/auth.middleware';
import { authorize } from '../../../shared/middleware/authorize.middleware';
import { setTenantContext } from '../../../shared/middleware/tenant.middleware';
import {
  createManpowerLogSchema,
  updateManpowerLogSchema,
  manpowerLogQuerySchema,
} from '../schemas/manpower-log.schema';
import { manpowerLogService } from '../services/manpower-log.service';
import { logger } from '../../../shared/logger';
import { AuthRequest } from '../../../shared/auth/types';

const router = Router();

router.use(authenticate);
router.use(setTenantContext);

router.get(
  '/',
  authorize({ resource: 'manpower-log', action: 'view' }),
  validate({ query: manpowerLogQuerySchema }),
  async (req: AuthRequest, res: Response) => {
    try {
      const companyId = req.companyId || req.tenantId;
      if (!companyId) {
        return void res.status(400).json({
          status: 'error',
          message: 'Company ID is required',
        });
      }

      const result = await manpowerLogService.listLogs(companyId, {
        page: req.query.page as number | undefined,
        limit: req.query.limit as number | undefined,
        projectId: req.query.projectId as string | undefined,
        fromDate: req.query.fromDate ? new Date(req.query.fromDate as string) : undefined,
        toDate: req.query.toDate ? new Date(req.query.toDate as string) : undefined,
        workerType: req.query.workerType as string | undefined,
        search: req.query.search as string | undefined,
      });

      return void res.json({
        status: 'success',
        data: result.logs,
        pagination: result.pagination,
      });
    } catch (error) {
      logger.error({ error }, 'Error listing manpower logs');
      return void res.status(500).json({
        status: 'error',
        message: error instanceof Error ? error.message : 'Failed to list manpower logs',
      });
    }
  }
);

router.get(
  '/:id',
  authorize({ resource: 'manpower-log', action: 'view' }),
  async (req: AuthRequest, res: Response) => {
    try {
      const companyId = req.companyId || req.tenantId;
      if (!companyId) {
        return void res.status(400).json({
          status: 'error',
          message: 'Company ID is required',
        });
      }

      const log = await manpowerLogService.getLogById(companyId, req.params.id);

      return void res.json({
        status: 'success',
        data: log,
      });
    } catch (error) {
      logger.error({ error }, 'Error getting manpower log');
      const status =
        error instanceof Error && error.message === 'Manpower log not found' ? 404 : 500;
      return void res.status(status).json({
        status: 'error',
        message: error instanceof Error ? error.message : 'Failed to get manpower log',
      });
    }
  }
);

router.post(
  '/',
  authorize({ resource: 'manpower-log', action: 'edit' }),
  validate({ body: createManpowerLogSchema }),
  async (req: AuthRequest, res: Response) => {
    try {
      const companyId = req.companyId || req.tenantId;
      if (!companyId) {
        return void res.status(400).json({
          status: 'error',
          message: 'Company ID is required',
        });
      }

      const data = {
        ...req.body,
        date:
          typeof req.body.date === 'string' ? new Date(req.body.date) : req.body.date,
      };

      const log = await manpowerLogService.createLog(companyId, data);

      return void res.status(201).json({
        status: 'success',
        message: 'Manpower log created successfully',
        data: log,
      });
    } catch (error) {
      logger.error({ error }, 'Error creating manpower log');
      return void res.status(500).json({
        status: 'error',
        message: error instanceof Error ? error.message : 'Failed to create manpower log',
      });
    }
  }
);

router.put(
  '/:id',
  authorize({ resource: 'manpower-log', action: 'edit' }),
  validate({ body: updateManpowerLogSchema }),
  async (req: AuthRequest, res: Response) => {
    try {
      const companyId = req.companyId || req.tenantId;
      if (!companyId) {
        return void res.status(400).json({
          status: 'error',
          message: 'Company ID is required',
        });
      }

      const data: any = { ...req.body };
      if (data.date && typeof data.date === 'string') {
        data.date = new Date(data.date);
      }

      const log = await manpowerLogService.updateLog(companyId, req.params.id, data);

      return void res.json({
        status: 'success',
        message: 'Manpower log updated successfully',
        data: log,
      });
    } catch (error) {
      logger.error({ error }, 'Error updating manpower log');
      const status =
        error instanceof Error && error.message === 'Manpower log not found' ? 404 : 500;
      return void res.status(status).json({
        status: 'error',
        message: error instanceof Error ? error.message : 'Failed to update manpower log',
      });
    }
  }
);

router.delete(
  '/:id',
  authorize({ resource: 'manpower-log', action: 'delete' }),
  async (req: AuthRequest, res: Response) => {
    try {
      const companyId = req.companyId || req.tenantId;
      if (!companyId) {
        return void res.status(400).json({
          status: 'error',
          message: 'Company ID is required',
        });
      }

      await manpowerLogService.deleteLog(companyId, req.params.id);

      return void res.status(204).send();
    } catch (error) {
      logger.error({ error }, 'Error deleting manpower log');
      const status =
        error instanceof Error && error.message === 'Manpower log not found' ? 404 : 500;
      return void res.status(status).json({
        status: 'error',
        message: error instanceof Error ? error.message : 'Failed to delete manpower log',
      });
    }
  }
);

export default router;

