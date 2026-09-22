import { Router, Response } from 'express';
import { authenticate } from '../../../shared/middleware/auth.middleware';
import { authorize } from '../../../shared/middleware/authorize.middleware';
import { setTenantContext } from '../../../shared/middleware/tenant.middleware';
import { itemQuantityService } from '../services/item-quantity.service';
import { logger } from '../../../shared/logger';
import { AuthRequest } from '../../../shared/auth/types';

const router = Router();

router.use(authenticate);
router.use(setTenantContext);

/**
 * GET /api/v1/inventory/item-quantities/item/:itemId
 * Get all quantities for an item across warehouses
 */
router.get(
  '/item/:itemId',
  authorize({ resource: 'item', action: 'view' }),
  async (req: AuthRequest, res: Response) => {
    try {
      const companyId = req.companyId || req.tenantId;
      if (!companyId) {
        return void res.status(400).json({
          status: 'error',
          message: 'Company ID is required',
        });
      }

      const quantities = await itemQuantityService.getItemQuantities(
        companyId,
        req.params.itemId,
        req.query.warehouseId as string | undefined
      );

      return void res.json({
        status: 'success',
        data: quantities,
      });
    } catch (error) {
      logger.error({ error }, 'Error getting item quantities');
      const status =
        error instanceof Error && error.message === 'Item not found'
          ? 404
          : 500;
      return void res.status(status).json({
        status: 'error',
        message:
          error instanceof Error
            ? error.message
            : 'Failed to get item quantities',
      });
    }
  }
);

/**
 * GET /api/v1/inventory/item-quantities/item/:itemId/total
 * Get total quantity for an item across all warehouses
 */
router.get(
  '/item/:itemId/total',
  authorize({ resource: 'item', action: 'view' }),
  async (req: AuthRequest, res: Response) => {
    try {
      const companyId = req.companyId || req.tenantId;
      if (!companyId) {
        return void res.status(400).json({
          status: 'error',
          message: 'Company ID is required',
        });
      }

      const total = await itemQuantityService.getTotalItemQuantity(
        companyId,
        req.params.itemId
      );

      return void res.json({
        status: 'success',
        data: total,
      });
    } catch (error) {
      logger.error({ error }, 'Error getting total item quantity');
      const status =
        error instanceof Error && error.message === 'Item not found'
          ? 404
          : 500;
      return void res.status(status).json({
        status: 'error',
        message:
          error instanceof Error
            ? error.message
            : 'Failed to get total item quantity',
      });
    }
  }
);

/**
 * GET /api/v1/inventory/item-quantities/warehouse/:warehouseId
 * Get all item quantities in a warehouse
 */
router.get(
  '/warehouse/:warehouseId',
  authorize({ resource: 'item', action: 'view' }),
  async (req: AuthRequest, res: Response) => {
    try {
      const companyId = req.companyId || req.tenantId;
      if (!companyId) {
        return void res.status(400).json({
          status: 'error',
          message: 'Company ID is required',
        });
      }

      const quantities = await itemQuantityService.getWarehouseQuantities(
        companyId,
        req.params.warehouseId,
        req.query.itemId as string | undefined
      );

      return void res.json({
        status: 'success',
        data: quantities,
      });
    } catch (error) {
      logger.error({ error }, 'Error getting warehouse quantities');
      const status =
        error instanceof Error &&
        (error.message === 'Warehouse not found' ||
          error.message === 'Item not found')
          ? 404
          : 500;
      return void res.status(status).json({
        status: 'error',
        message:
          error instanceof Error
            ? error.message
            : 'Failed to get warehouse quantities',
      });
    }
  }
);

/**
 * GET /api/v1/inventory/item-quantities/item/:itemId/warehouse/:warehouseId
 * Get item quantity by warehouse and optional location
 */
router.get(
  '/item/:itemId/warehouse/:warehouseId',
  authorize({ resource: 'item', action: 'view' }),
  async (req: AuthRequest, res: Response) => {
    try {
      const companyId = req.companyId || req.tenantId;
      if (!companyId) {
        return void res.status(400).json({
          status: 'error',
          message: 'Company ID is required',
        });
      }

      const quantity = await itemQuantityService.getItemQuantity(
        companyId,
        req.params.itemId,
        req.params.warehouseId,
        req.query.locationId as string | undefined
      );

      return void res.json({
        status: 'success',
        data: quantity,
      });
    } catch (error) {
      logger.error({ error }, 'Error getting item quantity');
      const status =
        error instanceof Error &&
        (error.message === 'Item not found' ||
          error.message === 'Warehouse not found')
          ? 404
          : 500;
      return void res.status(status).json({
        status: 'error',
        message:
          error instanceof Error
            ? error.message
            : 'Failed to get item quantity',
      });
    }
  }
);

export default router;
