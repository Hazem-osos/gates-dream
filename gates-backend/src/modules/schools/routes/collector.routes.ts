import { Router, Response } from 'express';
import { validate } from '../../../shared/middleware/validate';
import { authenticate } from '../../../shared/middleware/auth.middleware';
import { authorize } from '../../../shared/middleware/authorize.middleware';
import { setTenantContext } from '../../../shared/middleware/tenant.middleware';
import {
  createCollectorSchema,
  updateCollectorSchema,
  collectorQuerySchema,
} from '../schemas/collector.schema';
import { collectorService } from '../services/collector.service';
import { logger } from '../../../shared/logger';
import { AuthRequest } from '../../../shared/auth/types';

const router = Router();

router.use(authenticate);
router.use(setTenantContext);

router.get(
  '/',
  authorize({ resource: 'student', action: 'view' }),
  validate({ query: collectorQuerySchema }),
  async (req: AuthRequest, res: Response) => {
    try {
      const companyId = req.companyId || req.tenantId;
      if (!companyId) {
        return void res.status(400).json({
          status: 'error',
          message: 'Company ID is required',
        });
      }

      const result = await collectorService.listCollectors(companyId, {
        page: req.query.page as number | undefined,
        limit: req.query.limit as number | undefined,
        search: req.query.search as string | undefined,
        isActive: req.query.isActive as boolean | undefined,
      });

      return void res.json({
        status: 'success',
        data: result.collectors,
        pagination: result.pagination,
      });
    } catch (error) {
      logger.error({ error }, 'Error listing collectors');
      return void res.status(500).json({
        status: 'error',
        message: error instanceof Error ? error.message : 'Failed to list collectors',
      });
    }
  }
);

router.get(
  '/:id',
  authorize({ resource: 'student', action: 'view' }),
  async (req: AuthRequest, res: Response) => {
    try {
      const companyId = req.companyId || req.tenantId;
      if (!companyId) {
        return void res.status(400).json({
          status: 'error',
          message: 'Company ID is required',
        });
      }

      const collector = await collectorService.getCollectorById(companyId, req.params.id);
      return void res.json({ status: 'success', data: collector });
    } catch (error) {
      logger.error({ error }, 'Error getting collector');
      const status =
        error instanceof Error && error.message === 'Collector not found' ? 404 : 500;
      return void res.status(status).json({
        status: 'error',
        message: error instanceof Error ? error.message : 'Failed to get collector',
      });
    }
  }
);

router.post(
  '/',
  authorize({ resource: 'student', action: 'edit' }),
  validate({ body: createCollectorSchema }),
  async (req: AuthRequest, res: Response) => {
    try {
      const companyId = req.companyId || req.tenantId;
      if (!companyId) {
        return void res.status(400).json({
          status: 'error',
          message: 'Company ID is required',
        });
      }

      const collector = await collectorService.createCollector(companyId, req.body);
      return void res.status(201).json({
        status: 'success',
        message: 'Collector created successfully',
        data: collector,
      });
    } catch (error) {
      logger.error({ error }, 'Error creating collector');
      return void res.status(500).json({
        status: 'error',
        message: error instanceof Error ? error.message : 'Failed to create collector',
      });
    }
  }
);

router.put(
  '/:id',
  authorize({ resource: 'student', action: 'edit' }),
  validate({ body: updateCollectorSchema }),
  async (req: AuthRequest, res: Response) => {
    try {
      const companyId = req.companyId || req.tenantId;
      if (!companyId) {
        return void res.status(400).json({
          status: 'error',
          message: 'Company ID is required',
        });
      }

      const collector = await collectorService.updateCollector(companyId, req.params.id, req.body);
      return void res.json({
        status: 'success',
        message: 'Collector updated successfully',
        data: collector,
      });
    } catch (error) {
      logger.error({ error }, 'Error updating collector');
      const status =
        error instanceof Error && error.message === 'Collector not found' ? 404 : 500;
      return void res.status(status).json({
        status: 'error',
        message: error instanceof Error ? error.message : 'Failed to update collector',
      });
    }
  }
);

router.delete(
  '/:id',
  authorize({ resource: 'student', action: 'delete' }),
  async (req: AuthRequest, res: Response) => {
    try {
      const companyId = req.companyId || req.tenantId;
      if (!companyId) {
        return void res.status(400).json({
          status: 'error',
          message: 'Company ID is required',
        });
      }

      await collectorService.deleteCollector(companyId, req.params.id);
      return void res.json({ status: 'success', message: 'Collector deleted successfully' });
    } catch (error) {
      logger.error({ error }, 'Error deleting collector');
      const status =
        error instanceof Error && error.message === 'Collector not found' ? 404 : 500;
      return void res.status(status).json({
        status: 'error',
        message: error instanceof Error ? error.message : 'Failed to delete collector',
      });
    }
  }
);

export default router;
