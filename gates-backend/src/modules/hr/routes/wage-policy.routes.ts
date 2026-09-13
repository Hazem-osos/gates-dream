import { Router, Response } from 'express';
import { validate } from '../../../shared/middleware/validate';
import { authenticate } from '../../../shared/middleware/auth.middleware';
import { authorize } from '../../../shared/middleware/authorize.middleware';
import { setTenantContext } from '../../../shared/middleware/tenant.middleware';
import {
  createWagePolicySchema,
  updateWagePolicySchema,
  wagePolicyQuerySchema,
} from '../schemas/wage-policy.schema';
import { wagePolicyService } from '../services/wage-policy.service';
import { logger } from '../../../shared/logger';
import { AuthRequest } from '../../../shared/auth/types';

const router = Router();

router.use(authenticate);
router.use(setTenantContext);

router.get(
  '/',
  authorize({ resource: 'wage-policy', action: 'view' }),
  validate({ query: wagePolicyQuerySchema }),
  async (req: AuthRequest, res: Response) => {
    try {
      const companyId = req.companyId || req.tenantId;
      if (!companyId) {
        return void res.status(400).json({
          status: 'error',
          message: 'Company ID is required',
        });
      }

      const result = await wagePolicyService.listWagePolicies(companyId, {
        page: req.query.page as number | undefined,
        limit: req.query.limit as number | undefined,
        search: req.query.search as string | undefined,
        isActive: req.query.isActive as boolean | undefined,
      });

      logger.info(
        { companyId, count: result.wagePolicies.length },
        'Wage policies listed'
      );

      return void res.json({
        status: 'success',
        data: result.wagePolicies,
        pagination: result.pagination,
      });
    } catch (error) {
      logger.error({ error }, 'Error listing wage policies');
      return void res.status(500).json({
        status: 'error',
        message:
          error instanceof Error
            ? error.message
            : 'Failed to list wage policies',
      });
    }
  }
);

router.get(
  '/:id',
  authorize({ resource: 'wage-policy', action: 'view' }),
  async (req: AuthRequest, res: Response) => {
    try {
      const companyId = req.companyId || req.tenantId;
      if (!companyId) {
        return void res.status(400).json({
          status: 'error',
          message: 'Company ID is required',
        });
      }

      const wagePolicy = await wagePolicyService.getWagePolicyById(
        companyId,
        req.params.id
      );

      return void res.json({
        status: 'success',
        data: wagePolicy,
      });
    } catch (error) {
      logger.error({ error }, 'Error getting wage policy');
      const status =
        error instanceof Error && error.message === 'Wage policy not found'
          ? 404
          : 500;
      return void res.status(status).json({
        status: 'error',
        message:
          error instanceof Error ? error.message : 'Failed to get wage policy',
      });
    }
  }
);

router.post(
  '/',
  authorize({ resource: 'wage-policy', action: 'edit' }),
  validate({ body: createWagePolicySchema }),
  async (req: AuthRequest, res: Response) => {
    try {
      const companyId = req.companyId || req.tenantId;
      if (!companyId) {
        return void res.status(400).json({
          status: 'error',
          message: 'Company ID is required',
        });
      }

      const wagePolicy = await wagePolicyService.createWagePolicy(
        companyId,
        req.body
      );

      logger.info({ companyId, wagePolicyId: wagePolicy.id }, 'Wage policy created');

      return void res.status(201).json({
        status: 'success',
        message: 'Wage policy created successfully',
        data: wagePolicy,
      });
    } catch (error) {
      logger.error({ error, body: req.body }, 'Error creating wage policy');
      return void res.status(500).json({
        status: 'error',
        message:
          error instanceof Error ? error.message : 'Failed to create wage policy',
      });
    }
  }
);

router.put(
  '/:id',
  authorize({ resource: 'wage-policy', action: 'edit' }),
  validate({ body: updateWagePolicySchema }),
  async (req: AuthRequest, res: Response) => {
    try {
      const companyId = req.companyId || req.tenantId;
      if (!companyId) {
        return void res.status(400).json({
          status: 'error',
          message: 'Company ID is required',
        });
      }

      const wagePolicy = await wagePolicyService.updateWagePolicy(
        companyId,
        req.params.id,
        req.body
      );

      return void res.json({
        status: 'success',
        message: 'Wage policy updated successfully',
        data: wagePolicy,
      });
    } catch (error) {
      logger.error(
        { error, wagePolicyId: req.params.id },
        'Error updating wage policy'
      );
      const status =
        error instanceof Error && error.message === 'Wage policy not found'
          ? 404
          : 500;
      return void res.status(status).json({
        status: 'error',
        message:
          error instanceof Error ? error.message : 'Failed to update wage policy',
      });
    }
  }
);

router.delete(
  '/:id',
  authorize({ resource: 'wage-policy', action: 'delete' }),
  async (req: AuthRequest, res: Response) => {
    try {
      const companyId = req.companyId || req.tenantId;
      if (!companyId) {
        return void res.status(400).json({
          status: 'error',
          message: 'Company ID is required',
        });
      }

      await wagePolicyService.deleteWagePolicy(companyId, req.params.id);

      return void res.status(204).send();
    } catch (error) {
      logger.error(
        { error, wagePolicyId: req.params.id },
        'Error deleting wage policy'
      );
      const status =
        error instanceof Error && error.message === 'Wage policy not found'
          ? 404
          : 500;
      return void res.status(status).json({
        status: 'error',
        message:
          error instanceof Error ? error.message : 'Failed to delete wage policy',
      });
    }
  }
);

export default router;
