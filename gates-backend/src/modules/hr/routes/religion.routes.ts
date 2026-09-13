import { Router, Response } from 'express';
import { validate } from '../../../shared/middleware/validate';
import { authenticate } from '../../../shared/middleware/auth.middleware';
import { authorize } from '../../../shared/middleware/authorize.middleware';
import { setTenantContext } from '../../../shared/middleware/tenant.middleware';
import {
  createReligionSchema,
  updateReligionSchema,
  religionQuerySchema,
} from '../schemas/religion.schema';
import { religionService } from '../services/religion.service';
import { logger } from '../../../shared/logger';
import { AuthRequest } from '../../../shared/auth/types';

const router = Router();

router.use(authenticate);
router.use(setTenantContext);

router.get(
  '/',
  authorize({ resource: 'religion', action: 'view' }),
  validate({ query: religionQuerySchema }),
  async (req: AuthRequest, res: Response) => {
    try {
      const companyId = req.companyId || req.tenantId;
      if (!companyId) {
        return void res.status(400).json({
          status: 'error',
          message: 'Company ID is required',
        });
      }

      const result = await religionService.listReligions(companyId, {
        page: req.query.page as number | undefined,
        limit: req.query.limit as number | undefined,
        search: req.query.search as string | undefined,
        isActive: req.query.isActive as boolean | undefined,
      });

      logger.info({ companyId, count: result.religions.length }, 'Religions listed');

      return void res.json({
        status: 'success',
        data: result.religions,
        pagination: result.pagination,
      });
    } catch (error) {
      logger.error({ error }, 'Error listing religions');
      return void res.status(500).json({
        status: 'error',
        message: error instanceof Error ? error.message : 'Failed to list religions',
      });
    }
  }
);

router.get(
  '/:id',
  authorize({ resource: 'religion', action: 'view' }),
  async (req: AuthRequest, res: Response) => {
    try {
      const companyId = req.companyId || req.tenantId;
      if (!companyId) {
        return void res.status(400).json({
          status: 'error',
          message: 'Company ID is required',
        });
      }

      const religion = await religionService.getReligionById(
        companyId,
        req.params.id
      );

      return void res.json({
        status: 'success',
        data: religion,
      });
    } catch (error) {
      logger.error({ error }, 'Error getting religion');
      const status =
        error instanceof Error && error.message === 'Religion not found' ? 404 : 500;
      return void res.status(status).json({
        status: 'error',
        message: error instanceof Error ? error.message : 'Failed to get religion',
      });
    }
  }
);

router.post(
  '/',
  authorize({ resource: 'religion', action: 'edit' }),
  validate({ body: createReligionSchema }),
  async (req: AuthRequest, res: Response) => {
    try {
      const companyId = req.companyId || req.tenantId;
      if (!companyId) {
        return void res.status(400).json({
          status: 'error',
          message: 'Company ID is required',
        });
      }

      const religion = await religionService.createReligion(companyId, req.body);

      logger.info({ companyId, religionId: religion.id }, 'Religion created');

      return void res.status(201).json({
        status: 'success',
        message: 'Religion created successfully',
        data: religion,
      });
    } catch (error) {
      logger.error({ error, body: req.body }, 'Error creating religion');
      return void res.status(500).json({
        status: 'error',
        message: error instanceof Error ? error.message : 'Failed to create religion',
      });
    }
  }
);

router.put(
  '/:id',
  authorize({ resource: 'religion', action: 'edit' }),
  validate({ body: updateReligionSchema }),
  async (req: AuthRequest, res: Response) => {
    try {
      const companyId = req.companyId || req.tenantId;
      if (!companyId) {
        return void res.status(400).json({
          status: 'error',
          message: 'Company ID is required',
        });
      }

      const religion = await religionService.updateReligion(
        companyId,
        req.params.id,
        req.body
      );

      return void res.json({
        status: 'success',
        message: 'Religion updated successfully',
        data: religion,
      });
    } catch (error) {
      logger.error({ error, religionId: req.params.id }, 'Error updating religion');
      const status =
        error instanceof Error && error.message === 'Religion not found' ? 404 : 500;
      return void res.status(status).json({
        status: 'error',
        message: error instanceof Error ? error.message : 'Failed to update religion',
      });
    }
  }
);

router.delete(
  '/:id',
  authorize({ resource: 'religion', action: 'delete' }),
  async (req: AuthRequest, res: Response) => {
    try {
      const companyId = req.companyId || req.tenantId;
      if (!companyId) {
        return void res.status(400).json({
          status: 'error',
          message: 'Company ID is required',
        });
      }

      await religionService.deleteReligion(companyId, req.params.id);

      return void res.status(204).send();
    } catch (error) {
      logger.error({ error, religionId: req.params.id }, 'Error deleting religion');
      const status =
        error instanceof Error && error.message === 'Religion not found' ? 404 : 500;
      return void res.status(status).json({
        status: 'error',
        message: error instanceof Error ? error.message : 'Failed to delete religion',
      });
    }
  }
);

export default router;
