import { Router, Response } from 'express';
import { validate } from '../../../shared/middleware/validate';
import { authenticate } from '../../../shared/middleware/auth.middleware';
import { authorize } from '../../../shared/middleware/authorize.middleware';
import { setTenantContext } from '../../../shared/middleware/tenant.middleware';
import {
  createDocumentaryCreditSchema,
  updateDocumentaryCreditSchema,
} from '../schemas/documentary-credit.schema';
import { documentaryCreditService } from '../services/documentary-credit.service';
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
  approvalStatus: z.enum(['open', 'closed']).optional(),
});

router.get(
  '/',
  authorize({ resource: 'documentary-credit', action: 'view' }),
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

      const result = await documentaryCreditService.list(companyId, {
        page: req.query.page as number | undefined,
        limit: req.query.limit as number | undefined,
        search: req.query.search as string | undefined,
        approvalStatus: req.query.approvalStatus as string | undefined,
      });

      return void res.json({
        status: 'success',
        data: result.data,
        pagination: result.pagination,
      });
    } catch (error) {
      logger.error({ error }, 'Error listing documentary credits');
      return void res.status(500).json({
        status: 'error',
        message: error instanceof Error ? error.message : 'Failed to list documentary credits',
      });
    }
  }
);

router.get(
  '/:id',
  authorize({ resource: 'documentary-credit', action: 'view' }),
  async (req: AuthRequest, res: Response) => {
    try {
      const companyId = req.companyId || req.tenantId;
      if (!companyId) {
        return void res.status(400).json({
          status: 'error',
          message: 'Company ID is required',
        });
      }

      const credit = await documentaryCreditService.getById(companyId, req.params.id);

      return void res.json({
        status: 'success',
        data: credit,
      });
    } catch (error) {
      logger.error({ error }, 'Error getting documentary credit');
      const status = error instanceof Error && error.message === 'Documentary credit not found' ? 404 : 500;
      return void res.status(status).json({
        status: 'error',
        message: error instanceof Error ? error.message : 'Failed to get documentary credit',
      });
    }
  }
);

router.post(
  '/',
  authorize({ resource: 'documentary-credit', action: 'edit' }),
  validate({ body: createDocumentaryCreditSchema }),
  async (req: AuthRequest, res: Response) => {
    try {
      const companyId = req.companyId || req.tenantId;
      if (!companyId) {
        return void res.status(400).json({
          status: 'error',
          message: 'Company ID is required',
        });
      }

      const credit = await documentaryCreditService.create(companyId, req.body);

      return void res.status(201).json({
        status: 'success',
        message: 'Documentary credit created successfully',
        data: credit,
      });
    } catch (error) {
      logger.error({ error }, 'Error creating documentary credit');
      return void res.status(500).json({
        status: 'error',
        message: error instanceof Error ? error.message : 'Failed to create documentary credit',
      });
    }
  }
);

router.put(
  '/:id',
  authorize({ resource: 'documentary-credit', action: 'edit' }),
  validate({ body: updateDocumentaryCreditSchema }),
  async (req: AuthRequest, res: Response) => {
    try {
      const companyId = req.companyId || req.tenantId;
      if (!companyId) {
        return void res.status(400).json({
          status: 'error',
          message: 'Company ID is required',
        });
      }

      const credit = await documentaryCreditService.update(companyId, req.params.id, req.body);

      return void res.json({
        status: 'success',
        message: 'Documentary credit updated successfully',
        data: credit,
      });
    } catch (error) {
      logger.error({ error }, 'Error updating documentary credit');
      const status = error instanceof Error && error.message === 'Documentary credit not found' ? 404 : 500;
      return void res.status(status).json({
        status: 'error',
        message: error instanceof Error ? error.message : 'Failed to update documentary credit',
      });
    }
  }
);

router.delete(
  '/:id',
  authorize({ resource: 'documentary-credit', action: 'delete' }),
  async (req: AuthRequest, res: Response) => {
    try {
      const companyId = req.companyId || req.tenantId;
      if (!companyId) {
        return void res.status(400).json({
          status: 'error',
          message: 'Company ID is required',
        });
      }

      await documentaryCreditService.delete(companyId, req.params.id);

      return void res.status(204).send();
    } catch (error) {
      logger.error({ error }, 'Error deleting documentary credit');
      const status = error instanceof Error && error.message === 'Documentary credit not found' ? 404 : 500;
      return void res.status(status).json({
        status: 'error',
        message: error instanceof Error ? error.message : 'Failed to delete documentary credit',
      });
    }
  }
);

export default router;

