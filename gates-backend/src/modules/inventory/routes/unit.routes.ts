import { Router, Response } from 'express';
import { validate } from '../../../shared/middleware/validate';
import { authenticate } from '../../../shared/middleware/auth.middleware';
import { authorize } from '../../../shared/middleware/authorize.middleware';
import { setTenantContext } from '../../../shared/middleware/tenant.middleware';
import {
  createUnitSchema,
  updateUnitSchema,
  unitQuerySchema,
} from '../schemas/unit.schema';
import { unitService } from '../services/unit.service';
import { logger } from '../../../shared/logger';
import { AppError } from '../../../shared/middleware/error-handler';
import { AuthRequest } from '../../../shared/auth/types';

function unitErrorStatus(error: unknown): number {
  if (error instanceof AppError) return error.statusCode;
  return 500;
}

const router = Router();

router.use(authenticate);
router.use(setTenantContext);

/**
 * GET /api/v1/inventory/units
 * List units
 */
router.get(
  '/',
  authorize({ resource: 'unit', action: 'view' }),
  validate({ query: unitQuerySchema }),
  async (req: AuthRequest, res: Response) => {
    try {
      const companyId = req.companyId || req.tenantId;
      if (!companyId) {
        return void res.status(400).json({
          status: 'error',
          message: 'Company ID is required',
        });
      }

      const result = await unitService.listUnits(companyId, {
        page: req.query.page as number | undefined,
        limit: req.query.limit as number | undefined,
        search: req.query.search as string | undefined,
        isActive: req.query.isActive as boolean | undefined,
      });

      return void res.json({
        status: 'success',
        data: result.units,
        pagination: result.pagination,
      });
    } catch (error) {
      logger.error({ error }, 'Error listing units');
      return void res.status(500).json({
        status: 'error',
        message:
          error instanceof Error ? error.message : 'Failed to list units',
      });
    }
  }
);

/**
 * GET /api/v1/inventory/units/:id
 * Get unit by ID
 */
router.get(
  '/:id',
  authorize({ resource: 'unit', action: 'view' }),
  async (req: AuthRequest, res: Response) => {
    try {
      const companyId = req.companyId || req.tenantId;
      if (!companyId) {
        return void res.status(400).json({
          status: 'error',
          message: 'Company ID is required',
        });
      }

      const unit = await unitService.getUnitById(companyId, req.params.id);

      return void res.json({
        status: 'success',
        data: unit,
      });
    } catch (error) {
      logger.error({ error }, 'Error getting unit');
      return void res.status(unitErrorStatus(error)).json({
        status: 'error',
        message:
          error instanceof Error ? error.message : 'Failed to get unit',
      });
    }
  }
);

/**
 * POST /api/v1/inventory/units
 * Create unit
 */
router.post(
  '/',
  authorize({ resource: 'unit', action: 'edit' }),
  validate({ body: createUnitSchema }),
  async (req: AuthRequest, res: Response) => {
    try {
      const companyId = req.companyId || req.tenantId;
      if (!companyId) {
        return void res.status(400).json({
          status: 'error',
          message: 'Company ID is required',
        });
      }

      const unit = await unitService.createUnit(companyId, req.body);

      return void res.status(201).json({
        status: 'success',
        message: 'Unit created successfully',
        data: unit,
      });
    } catch (error) {
      logger.error({ error }, 'Error creating unit');
      return void res.status(unitErrorStatus(error)).json({
        status: 'error',
        message:
          error instanceof Error ? error.message : 'Failed to create unit',
      });
    }
  }
);

/**
 * PUT /api/v1/inventory/units/:id
 * Update unit
 */
router.put(
  '/:id',
  authorize({ resource: 'unit', action: 'edit' }),
  validate({ body: updateUnitSchema }),
  async (req: AuthRequest, res: Response) => {
    try {
      const companyId = req.companyId || req.tenantId;
      if (!companyId) {
        return void res.status(400).json({
          status: 'error',
          message: 'Company ID is required',
        });
      }

      const unit = await unitService.updateUnit(
        companyId,
        req.params.id,
        req.body
      );

      return void res.json({
        status: 'success',
        message: 'Unit updated successfully',
        data: unit,
      });
    } catch (error) {
      logger.error({ error }, 'Error updating unit');
      return void res.status(unitErrorStatus(error)).json({
        status: 'error',
        message:
          error instanceof Error ? error.message : 'Failed to update unit',
      });
    }
  }
);

/**
 * DELETE /api/v1/inventory/units/:id
 * Delete unit
 */
router.delete(
  '/:id',
  authorize({ resource: 'unit', action: 'delete' }),
  async (req: AuthRequest, res: Response) => {
    try {
      const companyId = req.companyId || req.tenantId;
      if (!companyId) {
        return void res.status(400).json({
          status: 'error',
          message: 'Company ID is required',
        });
      }

      await unitService.deleteUnit(companyId, req.params.id);

      return void res.status(204).send();
    } catch (error) {
      logger.error({ error }, 'Error deleting unit');
      return void res.status(unitErrorStatus(error)).json({
        status: 'error',
        message:
          error instanceof Error ? error.message : 'Failed to delete unit',
      });
    }
  }
);

export default router;
