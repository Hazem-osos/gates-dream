import { Router, Response } from 'express';
import { validate } from '../../../shared/middleware/validate';
import { authenticate } from '../../../shared/middleware/auth.middleware';
import { authorize } from '../../../shared/middleware/authorize.middleware';
import { setTenantContext } from '../../../shared/middleware/tenant.middleware';
import {
  createLetterOfGuaranteeSchema,
  updateLetterOfGuaranteeSchema,
  renewLetterOfGuaranteeSchema,
} from '../schemas/letter-of-guarantee.schema';
import { letterOfGuaranteeService } from '../services/letter-of-guarantee.service';
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
  letterType: z.enum(['incoming', 'outgoing']).optional(),
  approvalStatus: z.enum(['open', 'closed']).optional(),
});

router.get(
  '/',
  authorize({ resource: 'letter-of-guarantee', action: 'view' }),
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

      const result = await letterOfGuaranteeService.list(companyId, {
        page: req.query.page as number | undefined,
        limit: req.query.limit as number | undefined,
        search: req.query.search as string | undefined,
        letterType: req.query.letterType as string | undefined,
        approvalStatus: req.query.approvalStatus as string | undefined,
      });

      return void res.json({
        status: 'success',
        data: result.data,
        pagination: result.pagination,
      });
    } catch (error) {
      logger.error({ error }, 'Error listing letters of guarantee');
      return void res.status(500).json({
        status: 'error',
        message: error instanceof Error ? error.message : 'Failed to list letters of guarantee',
      });
    }
  }
);

router.get(
  '/:id',
  authorize({ resource: 'letter-of-guarantee', action: 'view' }),
  async (req: AuthRequest, res: Response) => {
    try {
      const companyId = req.companyId || req.tenantId;
      if (!companyId) {
        return void res.status(400).json({
          status: 'error',
          message: 'Company ID is required',
        });
      }

      const letter = await letterOfGuaranteeService.getById(companyId, req.params.id);

      return void res.json({
        status: 'success',
        data: letter,
      });
    } catch (error) {
      logger.error({ error }, 'Error getting letter of guarantee');
      const status = error instanceof Error && error.message === 'Letter of guarantee not found' ? 404 : 500;
      return void res.status(status).json({
        status: 'error',
        message: error instanceof Error ? error.message : 'Failed to get letter of guarantee',
      });
    }
  }
);

router.post(
  '/',
  authorize({ resource: 'letter-of-guarantee', action: 'edit' }),
  validate({ body: createLetterOfGuaranteeSchema }),
  async (req: AuthRequest, res: Response) => {
    try {
      const companyId = req.companyId || req.tenantId;
      if (!companyId) {
        return void res.status(400).json({
          status: 'error',
          message: 'Company ID is required',
        });
      }

      const letter = await letterOfGuaranteeService.create(companyId, req.body);

      return void res.status(201).json({
        status: 'success',
        message: 'Letter of guarantee created successfully',
        data: letter,
      });
    } catch (error) {
      logger.error({ error }, 'Error creating letter of guarantee');
      return void res.status(500).json({
        status: 'error',
        message: error instanceof Error ? error.message : 'Failed to create letter of guarantee',
      });
    }
  }
);

router.put(
  '/:id',
  authorize({ resource: 'letter-of-guarantee', action: 'edit' }),
  validate({ body: updateLetterOfGuaranteeSchema }),
  async (req: AuthRequest, res: Response) => {
    try {
      const companyId = req.companyId || req.tenantId;
      if (!companyId) {
        return void res.status(400).json({
          status: 'error',
          message: 'Company ID is required',
        });
      }

      const letter = await letterOfGuaranteeService.update(companyId, req.params.id, req.body);

      return void res.json({
        status: 'success',
        message: 'Letter of guarantee updated successfully',
        data: letter,
      });
    } catch (error) {
      logger.error({ error }, 'Error updating letter of guarantee');
      const status = error instanceof Error && error.message === 'Letter of guarantee not found' ? 404 : 500;
      return void res.status(status).json({
        status: 'error',
        message: error instanceof Error ? error.message : 'Failed to update letter of guarantee',
      });
    }
  }
);

router.delete(
  '/:id',
  authorize({ resource: 'letter-of-guarantee', action: 'delete' }),
  async (req: AuthRequest, res: Response) => {
    try {
      const companyId = req.companyId || req.tenantId;
      if (!companyId) {
        return void res.status(400).json({
          status: 'error',
          message: 'Company ID is required',
        });
      }

      await letterOfGuaranteeService.delete(companyId, req.params.id);

      return void res.status(204).send();
    } catch (error) {
      logger.error({ error }, 'Error deleting letter of guarantee');
      const status = error instanceof Error && error.message === 'Letter of guarantee not found' ? 404 : 500;
      return void res.status(status).json({
        status: 'error',
        message: error instanceof Error ? error.message : 'Failed to delete letter of guarantee',
      });
    }
  }
);

router.post(
  '/:id/renew',
  authorize({ resource: 'letter-of-guarantee', action: 'edit' }),
  validate({ body: renewLetterOfGuaranteeSchema }),
  async (req: AuthRequest, res: Response) => {
    try {
      const companyId = req.companyId || req.tenantId;
      if (!companyId) {
        return void res.status(400).json({
          status: 'error',
          message: 'Company ID is required',
        });
      }

      const letter = await letterOfGuaranteeService.renew(companyId, req.params.id, req.body);

      return void res.status(201).json({
        status: 'success',
        message: 'Letter of guarantee renewed successfully',
        data: letter,
      });
    } catch (error) {
      logger.error({ error }, 'Error renewing letter of guarantee');
      const status = error instanceof Error && error.message === 'Letter of guarantee not found' ? 404 : 500;
      return void res.status(status).json({
        status: 'error',
        message: error instanceof Error ? error.message : 'Failed to renew letter of guarantee',
      });
    }
  }
);

export default router;

