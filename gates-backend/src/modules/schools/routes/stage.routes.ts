import { Router, Response } from 'express';
import { validate } from '../../../shared/middleware/validate';
import { authenticate } from '../../../shared/middleware/auth.middleware';
import { authorize } from '../../../shared/middleware/authorize.middleware';
import { setTenantContext } from '../../../shared/middleware/tenant.middleware';
import {
  createStageSchema,
  updateStageSchema,
  stageQuerySchema,
} from '../schemas/stage.schema';
import { stageService } from '../services/stage.service';
import { logger } from '../../../shared/logger';
import { AuthRequest } from '../../../shared/auth/types';

const router = Router();

router.use(authenticate);
router.use(setTenantContext);

router.get(
  '/',
  authorize({ resource: 'stage', action: 'view' }),
  validate({ query: stageQuerySchema }),
  async (req: AuthRequest, res: Response) => {
    try {
      const companyId = req.companyId || req.tenantId;
      if (!companyId) {
        return void res.status(400).json({
          status: 'error',
          message: 'Company ID is required',
        });
      }

      const result = await stageService.listStages(companyId, {
        page: req.query.page as number | undefined,
        limit: req.query.limit as number | undefined,
        search: req.query.search as string | undefined,
        isActive: req.query.isActive as boolean | undefined,
      });

      logger.info({ companyId, count: result.stages.length }, 'Stages listed');

      return void res.json({
        status: 'success',
        data: result.stages,
        pagination: result.pagination,
      });
    } catch (error) {
      logger.error({ error }, 'Error listing stages');
      return void res.status(500).json({
        status: 'error',
        message: error instanceof Error ? error.message : 'Failed to list stages',
      });
    }
  }
);

router.get(
  '/:id',
  authorize({ resource: 'stage', action: 'view' }),
  async (req: AuthRequest, res: Response) => {
    try {
      const companyId = req.companyId || req.tenantId;
      if (!companyId) {
        return void res.status(400).json({
          status: 'error',
          message: 'Company ID is required',
        });
      }

      const stage = await stageService.getStageById(companyId, req.params.id);

      return void res.json({
        status: 'success',
        data: stage,
      });
    } catch (error) {
      logger.error({ error }, 'Error getting stage');
      const status =
        error instanceof Error && error.message === 'Stage not found' ? 404 : 500;
      return void res.status(status).json({
        status: 'error',
        message: error instanceof Error ? error.message : 'Failed to get stage',
      });
    }
  }
);

router.post(
  '/',
  authorize({ resource: 'stage', action: 'edit' }),
  validate({ body: createStageSchema }),
  async (req: AuthRequest, res: Response) => {
    try {
      const companyId = req.companyId || req.tenantId;
      if (!companyId) {
        return void res.status(400).json({
          status: 'error',
          message: 'Company ID is required',
        });
      }

      const stage = await stageService.createStage(companyId, req.body);

      logger.info({ companyId, stageId: stage.id }, 'Stage created');

      return void res.status(201).json({
        status: 'success',
        message: 'Stage created successfully',
        data: stage,
      });
    } catch (error) {
      logger.error({ error, body: req.body }, 'Error creating stage');
      return void res.status(500).json({
        status: 'error',
        message: error instanceof Error ? error.message : 'Failed to create stage',
      });
    }
  }
);

router.put(
  '/:id',
  authorize({ resource: 'stage', action: 'edit' }),
  validate({ body: updateStageSchema }),
  async (req: AuthRequest, res: Response) => {
    try {
      const companyId = req.companyId || req.tenantId;
      if (!companyId) {
        return void res.status(400).json({
          status: 'error',
          message: 'Company ID is required',
        });
      }

      const stage = await stageService.updateStage(
        companyId,
        req.params.id,
        req.body
      );

      return void res.json({
        status: 'success',
        message: 'Stage updated successfully',
        data: stage,
      });
    } catch (error) {
      logger.error({ error, stageId: req.params.id }, 'Error updating stage');
      const status =
        error instanceof Error && error.message === 'Stage not found' ? 404 : 500;
      return void res.status(status).json({
        status: 'error',
        message: error instanceof Error ? error.message : 'Failed to update stage',
      });
    }
  }
);

router.delete(
  '/:id',
  authorize({ resource: 'stage', action: 'delete' }),
  async (req: AuthRequest, res: Response) => {
    try {
      const companyId = req.companyId || req.tenantId;
      if (!companyId) {
        return void res.status(400).json({
          status: 'error',
          message: 'Company ID is required',
        });
      }

      await stageService.deleteStage(companyId, req.params.id);

      return void res.status(204).send();
    } catch (error) {
      logger.error({ error, stageId: req.params.id }, 'Error deleting stage');
      const status =
        error instanceof Error && error.message === 'Stage not found' ? 404 : 500;
      return void res.status(status).json({
        status: 'error',
        message: error instanceof Error ? error.message : 'Failed to delete stage',
      });
    }
  }
);

export default router;
