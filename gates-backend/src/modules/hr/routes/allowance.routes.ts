import { Router, Response } from 'express';
import { validate } from '../../../shared/middleware/validate';
import { authenticate } from '../../../shared/middleware/auth.middleware';
import { authorize } from '../../../shared/middleware/authorize.middleware';
import { setTenantContext } from '../../../shared/middleware/tenant.middleware';
import {
  createAllowanceSchema,
  updateAllowanceSchema,
  allowanceQuerySchema,
} from '../schemas/allowance.schema';
import { allowanceService } from '../services/allowance.service';
import { logger } from '../../../shared/logger';
import { AuthRequest } from '../../../shared/auth/types';

const router = Router();

router.use(authenticate);
router.use(setTenantContext);

router.get(
  '/',
  authorize({ resource: 'allowance', action: 'view' }),
  validate({ query: allowanceQuerySchema }),
  async (req: AuthRequest, res: Response) => {
    try {
      const companyId = req.companyId || req.tenantId;
      if (!companyId) {
        return void res.status(400).json({
          status: 'error',
          message: 'Company ID is required',
        });
      }

      const result = await allowanceService.listAllowances(companyId, {
        page: req.query.page as number | undefined,
        limit: req.query.limit as number | undefined,
        search: req.query.search as string | undefined,
        isActive: req.query.isActive as boolean | undefined,
      });

      logger.info(
        { companyId, count: result.allowances.length },
        'Allowances listed'
      );

      return void res.json({
        status: 'success',
        data: result.allowances,
        pagination: result.pagination,
      });
    } catch (error) {
      logger.error({ error }, 'Error listing allowances');
      return void res.status(500).json({
        status: 'error',
        message:
          error instanceof Error ? error.message : 'Failed to list allowances',
      });
    }
  }
);

router.get(
  '/:id',
  authorize({ resource: 'allowance', action: 'view' }),
  async (req: AuthRequest, res: Response) => {
    try {
      const companyId = req.companyId || req.tenantId;
      if (!companyId) {
        return void res.status(400).json({
          status: 'error',
          message: 'Company ID is required',
        });
      }

      const allowance = await allowanceService.getAllowanceById(
        companyId,
        req.params.id
      );

      return void res.json({
        status: 'success',
        data: allowance,
      });
    } catch (error) {
      logger.error({ error }, 'Error getting allowance');
      const status =
        error instanceof Error && error.message === 'Allowance not found'
          ? 404
          : 500;
      return void res.status(status).json({
        status: 'error',
        message:
          error instanceof Error ? error.message : 'Failed to get allowance',
      });
    }
  }
);

router.post(
  '/',
  authorize({ resource: 'allowance', action: 'edit' }),
  validate({ body: createAllowanceSchema }),
  async (req: AuthRequest, res: Response) => {
    try {
      const companyId = req.companyId || req.tenantId;
      if (!companyId) {
        return void res.status(400).json({
          status: 'error',
          message: 'Company ID is required',
        });
      }

      const allowance = await allowanceService.createAllowance(
        companyId,
        req.body
      );

      logger.info({ companyId, allowanceId: allowance.id }, 'Allowance created');

      return void res.status(201).json({
        status: 'success',
        message: 'Allowance created successfully',
        data: allowance,
      });
    } catch (error) {
      logger.error({ error, body: req.body }, 'Error creating allowance');
      return void res.status(500).json({
        status: 'error',
        message:
          error instanceof Error ? error.message : 'Failed to create allowance',
      });
    }
  }
);

router.put(
  '/:id',
  authorize({ resource: 'allowance', action: 'edit' }),
  validate({ body: updateAllowanceSchema }),
  async (req: AuthRequest, res: Response) => {
    try {
      const companyId = req.companyId || req.tenantId;
      if (!companyId) {
        return void res.status(400).json({
          status: 'error',
          message: 'Company ID is required',
        });
      }

      const allowance = await allowanceService.updateAllowance(
        companyId,
        req.params.id,
        req.body
      );

      return void res.json({
        status: 'success',
        message: 'Allowance updated successfully',
        data: allowance,
      });
    } catch (error) {
      logger.error({ error, allowanceId: req.params.id }, 'Error updating allowance');
      const status =
        error instanceof Error && error.message === 'Allowance not found'
          ? 404
          : 500;
      return void res.status(status).json({
        status: 'error',
        message:
          error instanceof Error ? error.message : 'Failed to update allowance',
      });
    }
  }
);

router.delete(
  '/:id',
  authorize({ resource: 'allowance', action: 'delete' }),
  async (req: AuthRequest, res: Response) => {
    try {
      const companyId = req.companyId || req.tenantId;
      if (!companyId) {
        return void res.status(400).json({
          status: 'error',
          message: 'Company ID is required',
        });
      }

      await allowanceService.deleteAllowance(companyId, req.params.id);

      return void res.status(204).send();
    } catch (error) {
      logger.error({ error, allowanceId: req.params.id }, 'Error deleting allowance');
      const status =
        error instanceof Error && error.message === 'Allowance not found'
          ? 404
          : 500;
      return void res.status(status).json({
        status: 'error',
        message:
          error instanceof Error ? error.message : 'Failed to delete allowance',
      });
    }
  }
);

export default router;
