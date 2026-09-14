import { Router, Response } from 'express';
import { validate } from '../../../shared/middleware/validate';
import { authenticate } from '../../../shared/middleware/auth.middleware';
import { authorize } from '../../../shared/middleware/authorize.middleware';
import { setTenantContext } from '../../../shared/middleware/tenant.middleware';
import {
  createCostCenterSchema,
  updateCostCenterSchema,
  costCenterQuerySchema,
} from '../schemas/cost-center.schema';
import { costCenterService } from '../services/cost-center.service';
import { logger } from '../../../shared/logger';
import { AppError } from '../../../shared/middleware/error-handler';
import { AuthRequest } from '../../../shared/auth/types';

const router = Router();

router.use(authenticate);
router.use(setTenantContext);

/**
 * GET /api/v1/accounting/cost-centers
 * List cost centers
 */
// M22 fix: this route's resource string used to be the camelCase
// `'costCenter'`, matching neither the catalog's snake_case `cost_center`
// nor the kebab-case convention every other route uses — every occurrence
// below is now `'cost-center'` (see `role-definitions.service.ts` /
// `permission-definitions.service.ts`).
router.get(
  '/',
  authorize({ resource: 'cost-center', action: 'view' }),
  validate({ query: costCenterQuerySchema }),
  async (req: AuthRequest, res: Response) => {
    try {
      const companyId = req.companyId || req.tenantId;
      if (!companyId) {
        return void res.status(400).json({
          status: 'error',
          message: 'Company ID is required',
        });
      }

      const result = await costCenterService.listCostCenters(companyId, {
        page: req.query.page as number | undefined,
        limit: req.query.limit as number | undefined,
        search: req.query.search as string | undefined,
        isActive: req.query.isActive as boolean | undefined,
      });

      return void res.json({
        status: 'success',
        data: result.costCenters,
        pagination: result.pagination,
      });
    } catch (error) {
      logger.error({ error }, 'Error listing cost centers');
      return void res.status(500).json({
        status: 'error',
        message:
          error instanceof Error
            ? error.message
            : 'Failed to list cost centers',
      });
    }
  }
);

/**
 * GET /api/v1/accounting/cost-centers/:id
 * Get cost center by ID
 */
router.get(
  '/:id',
  authorize({ resource: 'cost-center', action: 'view' }),
  async (req: AuthRequest, res: Response) => {
    try {
      const companyId = req.companyId || req.tenantId;
      if (!companyId) {
        return void res.status(400).json({
          status: 'error',
          message: 'Company ID is required',
        });
      }

      const costCenter = await costCenterService.getCostCenterById(
        companyId,
        req.params.id
      );

      return void res.json({
        status: 'success',
        data: costCenter,
      });
    } catch (error) {
      logger.error({ error }, 'Error getting cost center');
      const status =
        error instanceof Error && error.message === 'Cost center not found'
          ? 404
          : 500;
      return void res.status(status).json({
        status: 'error',
        message:
          error instanceof Error
            ? error.message
            : 'Failed to get cost center',
      });
    }
  }
);

/**
 * POST /api/v1/accounting/cost-centers
 * Create cost center
 */
router.post(
  '/',
  authorize({ resource: 'cost-center', action: 'edit' }),
  validate({ body: createCostCenterSchema }),
  async (req: AuthRequest, res: Response) => {
    try {
      const companyId = req.companyId || req.tenantId;
      if (!companyId) {
        return void res.status(400).json({
          status: 'error',
          message: 'Company ID is required',
        });
      }

      const costCenter = await costCenterService.createCostCenter(
        companyId,
        req.body
      );

      return void res.status(201).json({
        status: 'success',
        message: 'Cost center created successfully',
        data: costCenter,
      });
    } catch (error) {
      logger.error({ error }, 'Error creating cost center');
      return void res.status(500).json({
        status: 'error',
        message:
          error instanceof Error
            ? error.message
            : 'Failed to create cost center',
      });
    }
  }
);

/**
 * PUT /api/v1/accounting/cost-centers/:id
 * Update cost center
 */
router.put(
  '/:id',
  authorize({ resource: 'cost-center', action: 'edit' }),
  validate({ body: updateCostCenterSchema }),
  async (req: AuthRequest, res: Response) => {
    try {
      const companyId = req.companyId || req.tenantId;
      if (!companyId) {
        return void res.status(400).json({
          status: 'error',
          message: 'Company ID is required',
        });
      }

      const costCenter = await costCenterService.updateCostCenter(
        companyId,
        req.params.id,
        req.body
      );

      return void res.json({
        status: 'success',
        message: 'Cost center updated successfully',
        data: costCenter,
      });
    } catch (error) {
      logger.error({ error }, 'Error updating cost center');
      const status =
        error instanceof Error && error.message === 'Cost center not found'
          ? 404
          : 500;
      return void res.status(status).json({
        status: 'error',
        message:
          error instanceof Error
            ? error.message
            : 'Failed to update cost center',
      });
    }
  }
);

/**
 * DELETE /api/v1/accounting/cost-centers/:id
 * Delete cost center
 */
router.delete(
  '/:id',
  authorize({ resource: 'cost-center', action: 'delete' }),
  async (req: AuthRequest, res: Response) => {
    try {
      const companyId = req.companyId || req.tenantId;
      if (!companyId) {
        return void res.status(400).json({
          status: 'error',
          message: 'Company ID is required',
        });
      }

      await costCenterService.deleteCostCenter(companyId, req.params.id);

      return void res.json({
        status: 'success',
        message: 'تم حذف مركز التكلفة',
      });
    } catch (error) {
      if (error instanceof AppError) {
        return void res.status(error.statusCode).json({
          status: 'error',
          message: error.message,
        });
      }
      logger.error({ error }, 'Error deleting cost center');
      return void res.status(500).json({
        status: 'error',
        message:
          error instanceof Error
            ? error.message
            : 'Failed to delete cost center',
      });
    }
  }
);

export default router;
