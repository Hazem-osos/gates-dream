import { Router, Response } from 'express';
import { validate } from '../../../shared/middleware/validate';
import { authenticate } from '../../../shared/middleware/auth.middleware';
import { authorize } from '../../../shared/middleware/authorize.middleware';
import { setTenantContext } from '../../../shared/middleware/tenant.middleware';
import {
  createDocumentaryCreditDefinitionSchema,
  updateDocumentaryCreditDefinitionSchema,
} from '../schemas/documentary-credit-definition.schema';
import { documentaryCreditDefinitionService } from '../services/documentary-credit-definition.service';
import { logger } from '../../../shared/logger';
import { AuthRequest } from '../../../shared/auth/types';
import { z } from 'zod';

const router = Router();

router.use(authenticate);
router.use(setTenantContext);

const querySchema = z.object({
  page: z.string().optional().transform((val) => (val ? parseInt(val, 10) : undefined)),
  limit: z.string().optional().transform((val) => (val ? parseInt(val, 10) : undefined)),
  search: z.string().optional(),
});

router.get(
  '/',
  authorize({ resource: 'documentary-credit-definition', action: 'view' }),
  validate({ query: querySchema }),
  async (req: AuthRequest, res: Response) => {
    try {
      const companyId = req.companyId || req.tenantId;
      if (!companyId) {
        return void res.status(400).json({
          status: 'error',
          message: 'Company ID is required',
        });
      }

      const result = await documentaryCreditDefinitionService.list(companyId, {
        page: req.query.page as number | undefined,
        limit: req.query.limit as number | undefined,
        search: req.query.search as string | undefined,
      });

      return void res.json({
        status: 'success',
        data: result.data,
        pagination: result.pagination,
      });
    } catch (error) {
      logger.error({ error }, 'Error listing documentary credit definitions');
      return void res.status(500).json({
        status: 'error',
        message: error instanceof Error ? error.message : 'Failed to list documentary credit definitions',
      });
    }
  }
);

router.get(
  '/:id',
  authorize({ resource: 'documentary-credit-definition', action: 'view' }),
  async (req: AuthRequest, res: Response) => {
    try {
      const companyId = req.companyId || req.tenantId;
      if (!companyId) {
        return void res.status(400).json({
          status: 'error',
          message: 'Company ID is required',
        });
      }

      const definition = await documentaryCreditDefinitionService.getById(companyId, req.params.id);

      return void res.json({
        status: 'success',
        data: definition,
      });
    } catch (error) {
      logger.error({ error }, 'Error getting documentary credit definition');
      const status = error instanceof Error && error.message === 'Documentary credit definition not found' ? 404 : 500;
      return void res.status(status).json({
        status: 'error',
        message: error instanceof Error ? error.message : 'Failed to get documentary credit definition',
      });
    }
  }
);

router.post(
  '/',
  authorize({ resource: 'documentary-credit-definition', action: 'edit' }),
  validate({ body: createDocumentaryCreditDefinitionSchema }),
  async (req: AuthRequest, res: Response) => {
    try {
      const companyId = req.companyId || req.tenantId;
      if (!companyId) {
        return void res.status(400).json({
          status: 'error',
          message: 'Company ID is required',
        });
      }

      const definition = await documentaryCreditDefinitionService.create(companyId, req.body);

      return void res.status(201).json({
        status: 'success',
        message: 'Documentary credit definition created successfully',
        data: definition,
      });
    } catch (error) {
      logger.error({ error }, 'Error creating documentary credit definition');
      return void res.status(500).json({
        status: 'error',
        message: error instanceof Error ? error.message : 'Failed to create documentary credit definition',
      });
    }
  }
);

router.put(
  '/:id',
  authorize({ resource: 'documentary-credit-definition', action: 'edit' }),
  validate({ body: updateDocumentaryCreditDefinitionSchema }),
  async (req: AuthRequest, res: Response) => {
    try {
      const companyId = req.companyId || req.tenantId;
      if (!companyId) {
        return void res.status(400).json({
          status: 'error',
          message: 'Company ID is required',
        });
      }

      const definition = await documentaryCreditDefinitionService.update(companyId, req.params.id, req.body);

      return void res.json({
        status: 'success',
        message: 'Documentary credit definition updated successfully',
        data: definition,
      });
    } catch (error) {
      logger.error({ error }, 'Error updating documentary credit definition');
      const status = error instanceof Error && error.message === 'Documentary credit definition not found' ? 404 : 500;
      return void res.status(status).json({
        status: 'error',
        message: error instanceof Error ? error.message : 'Failed to update documentary credit definition',
      });
    }
  }
);

router.delete(
  '/:id',
  authorize({ resource: 'documentary-credit-definition', action: 'delete' }),
  async (req: AuthRequest, res: Response) => {
    try {
      const companyId = req.companyId || req.tenantId;
      if (!companyId) {
        return void res.status(400).json({
          status: 'error',
          message: 'Company ID is required',
        });
      }

      await documentaryCreditDefinitionService.delete(companyId, req.params.id);

      return void res.status(204).send();
    } catch (error) {
      logger.error({ error }, 'Error deleting documentary credit definition');
      const status = error instanceof Error && error.message === 'Documentary credit definition not found' ? 404 : 500;
      return void res.status(status).json({
        status: 'error',
        message: error instanceof Error ? error.message : 'Failed to delete documentary credit definition',
      });
    }
  }
);

export default router;

