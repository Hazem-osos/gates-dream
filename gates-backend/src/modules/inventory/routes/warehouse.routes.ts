import { Router, Response } from 'express';
import { validate } from '../../../shared/middleware/validate';
import { authenticate } from '../../../shared/middleware/auth.middleware';
import { authorize } from '../../../shared/middleware/authorize.middleware';
import { setTenantContext } from '../../../shared/middleware/tenant.middleware';
import {
  createWarehouseSchema,
  updateWarehouseSchema,
  warehouseQuerySchema,
} from '../schemas/warehouse.schema';
import { warehouseService } from '../services/warehouse.service';
import { logger } from '../../../shared/logger';
import { AppError } from '../../../shared/middleware/error-handler';
import { AuthRequest } from '../../../shared/auth/types';

function warehouseErrorStatus(error: unknown): number {
  if (error instanceof AppError) return error.statusCode;
  if (error instanceof Error && error.message === 'Warehouse not found') return 404;
  return 500;
}

const router = Router();

router.use(authenticate);
router.use(setTenantContext);

/**
 * GET /api/v1/inventory/warehouses
 * List warehouses
 */
router.get(
  '/',
  authorize({ resource: 'warehouse', action: 'view' }),
  validate({ query: warehouseQuerySchema }),
  async (req: AuthRequest, res: Response) => {
    try {
      const companyId = req.companyId || req.tenantId;
      if (!companyId) {
        return void res.status(400).json({
          status: 'error',
          message: 'Company ID is required',
        });
      }

      const result = await warehouseService.listWarehouses(companyId, {
        page: req.query.page as number | undefined,
        limit: req.query.limit as number | undefined,
        search: req.query.search as string | undefined,
        branchId: req.query.branchId as string | undefined,
        isActive: req.query.isActive as boolean | undefined,
        leafOnly: req.query.leafOnly as boolean | undefined,
        headerOnly: req.query.headerOnly as boolean | undefined,
      });

      return void res.json({
        status: 'success',
        data: result.warehouses,
        pagination: result.pagination,
      });
    } catch (error) {
      logger.error({ error }, 'Error listing warehouses');
      return void res.status(500).json({
        status: 'error',
        message:
          error instanceof Error
            ? error.message
            : 'Failed to list warehouses',
      });
    }
  }
);

/**
 * GET /api/v1/inventory/warehouses/next-code
 */
router.get(
  '/next-code',
  authorize({ resource: 'warehouse', action: 'view' }),
  async (req: AuthRequest, res: Response) => {
    try {
      const companyId = req.companyId || req.tenantId;
      if (!companyId) {
        return void res.status(400).json({
          status: 'error',
          message: 'Company ID is required',
        });
      }
      const rawParent = String(req.query.parentWarehouseId ?? '').trim();
      const parentWarehouseId = /^[0-9a-f-]{36}$/i.test(rawParent) ? rawParent : null;
      const code = await warehouseService.suggestNextWarehouseCode(companyId, parentWarehouseId);
      return void res.json({
        status: 'success',
        data: { code, parentWarehouseId },
      });
    } catch (error) {
      logger.error({ error }, 'Error suggesting warehouse code');
      return void res.status(warehouseErrorStatus(error)).json({
        status: 'error',
        message:
          error instanceof Error ? error.message : 'Failed to suggest warehouse code',
      });
    }
  }
);

/**
 * GET /api/v1/inventory/warehouses/:id
 * Get warehouse by ID
 */
router.get(
  '/:id',
  authorize({ resource: 'warehouse', action: 'view' }),
  async (req: AuthRequest, res: Response) => {
    try {
      const companyId = req.companyId || req.tenantId;
      if (!companyId) {
        return void res.status(400).json({
          status: 'error',
          message: 'Company ID is required',
        });
      }

      const warehouse = await warehouseService.getWarehouseById(
        companyId,
        req.params.id
      );

      return void res.json({
        status: 'success',
        data: warehouse,
      });
    } catch (error) {
      logger.error({ error }, 'Error getting warehouse');
      const status = warehouseErrorStatus(error);
      return void res.status(status).json({
        status: 'error',
        message:
          error instanceof Error
            ? error.message
            : 'Failed to get warehouse',
      });
    }
  }
);

/**
 * POST /api/v1/inventory/warehouses
 * Create warehouse
 */
router.post(
  '/',
  authorize({ resource: 'warehouse', action: 'edit' }),
  validate({ body: createWarehouseSchema }),
  async (req: AuthRequest, res: Response) => {
    try {
      const companyId = req.companyId || req.tenantId;
      if (!companyId) {
        return void res.status(400).json({
          status: 'error',
          message: 'Company ID is required',
        });
      }

      const warehouse = await warehouseService.createWarehouse(
        companyId,
        req.body
      );

      return void res.status(201).json({
        status: 'success',
        message: 'Warehouse created successfully',
        data: warehouse,
      });
    } catch (error) {
      logger.error({ error }, 'Error creating warehouse');
      return void res.status(warehouseErrorStatus(error)).json({
        status: 'error',
        message:
          error instanceof Error
            ? error.message
            : 'Failed to create warehouse',
      });
    }
  }
);

/**
 * PUT /api/v1/inventory/warehouses/:id
 * Update warehouse
 */
router.put(
  '/:id',
  authorize({ resource: 'warehouse', action: 'edit' }),
  validate({ body: updateWarehouseSchema }),
  async (req: AuthRequest, res: Response) => {
    try {
      const companyId = req.companyId || req.tenantId;
      if (!companyId) {
        return void res.status(400).json({
          status: 'error',
          message: 'Company ID is required',
        });
      }

      const warehouse = await warehouseService.updateWarehouse(
        companyId,
        req.params.id,
        req.body
      );

      return void res.json({
        status: 'success',
        message: 'Warehouse updated successfully',
        data: warehouse,
      });
    } catch (error) {
      logger.error({ error }, 'Error updating warehouse');
      const status = warehouseErrorStatus(error);
      return void res.status(status).json({
        status: 'error',
        message:
          error instanceof Error
            ? error.message
            : 'Failed to update warehouse',
      });
    }
  }
);

/**
 * DELETE /api/v1/inventory/warehouses/:id
 * Delete warehouse
 */
router.delete(
  '/:id',
  authorize({ resource: 'warehouse', action: 'delete' }),
  async (req: AuthRequest, res: Response) => {
    try {
      const companyId = req.companyId || req.tenantId;
      if (!companyId) {
        return void res.status(400).json({
          status: 'error',
          message: 'Company ID is required',
        });
      }

      await warehouseService.deleteWarehouse(companyId, req.params.id);

      return void res.status(204).send();
    } catch (error) {
      logger.error({ error }, 'Error deleting warehouse');
      const status = warehouseErrorStatus(error);
      return void res.status(status).json({
        status: 'error',
        message:
          error instanceof Error
            ? error.message
            : 'Failed to delete warehouse',
      });
    }
  }
);

export default router;
