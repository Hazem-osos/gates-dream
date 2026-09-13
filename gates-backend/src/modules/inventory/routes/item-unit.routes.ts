import { Router, Response } from 'express';
import { validate } from '../../../shared/middleware/validate';
import { authenticate } from '../../../shared/middleware/auth.middleware';
import { authorize } from '../../../shared/middleware/authorize.middleware';
import { setTenantContext } from '../../../shared/middleware/tenant.middleware';
import {
  createItemUnitSchema,
  updateItemUnitSchema,
  itemUnitQuerySchema,
} from '../schemas/item-unit.schema';
import { itemUnitService } from '../services/item-unit.service';
import { logger } from '../../../shared/logger';
import { AuthRequest } from '../../../shared/auth/types';

const router = Router();

router.use(authenticate);
router.use(setTenantContext);

/**
 * GET /api/v1/inventory/item-units
 * List item units with pagination and filters
 */
router.get(
  '/',
  authorize({ resource: 'item-unit', action: 'view' }),
  validate({ query: itemUnitQuerySchema }),
  async (req: AuthRequest, res: Response) => {
    try {
      const companyId = req.companyId || req.tenantId;
      if (!companyId) {
        return void res.status(400).json({
          status: 'error',
          message: 'Company ID is required',
        });
      }

      const result = await itemUnitService.listItemUnits(companyId, {
        page: req.query.page as number | undefined,
        limit: req.query.limit as number | undefined,
        search: req.query.search as string | undefined,
        itemId: req.query.itemId as string | undefined,
        unitId: req.query.unitId as string | undefined,
        isBaseUnit: req.query.isBaseUnit as boolean | undefined,
      });

      logger.info(
        { companyId, count: result.itemUnits.length },
        'Item units listed'
      );

      return void res.json({
        status: 'success',
        data: result.itemUnits,
        pagination: result.pagination,
      });
    } catch (error) {
      logger.error({ error }, 'Error listing item units');
      return void res.status(500).json({
        status: 'error',
        message:
          error instanceof Error ? error.message : 'Failed to list item units',
      });
    }
  }
);

/**
 * GET /api/v1/inventory/item-units/:id
 * Get item unit by ID
 */
router.get(
  '/:id',
  authorize({ resource: 'item-unit', action: 'view' }),
  async (req: AuthRequest, res: Response) => {
    try {
      const companyId = req.companyId || req.tenantId;
      if (!companyId) {
        return void res.status(400).json({
          status: 'error',
          message: 'Company ID is required',
        });
      }

      const itemUnit = await itemUnitService.getItemUnitById(
        companyId,
        req.params.id
      );

      return void res.json({
        status: 'success',
        data: itemUnit,
      });
    } catch (error) {
      logger.error({ error }, 'Error getting item unit');
      const status =
        error instanceof Error && error.message === 'Item unit not found'
          ? 404
          : 500;
      return void res.status(status).json({
        status: 'error',
        message:
          error instanceof Error ? error.message : 'Failed to get item unit',
      });
    }
  }
);

/**
 * GET /api/v1/inventory/item-units/item/:itemId/unit/:unitId
 * Get item unit by item and unit
 */
router.get(
  '/item/:itemId/unit/:unitId',
  authorize({ resource: 'item-unit', action: 'view' }),
  async (req: AuthRequest, res: Response) => {
    try {
      const companyId = req.companyId || req.tenantId;
      if (!companyId) {
        return void res.status(400).json({
          status: 'error',
          message: 'Company ID is required',
        });
      }

      const itemUnit = await itemUnitService.getItemUnitByKeys(
        companyId,
        req.params.itemId,
        req.params.unitId
      );

      return void res.json({
        status: 'success',
        data: itemUnit,
      });
    } catch (error) {
      logger.error({ error }, 'Error getting item unit by keys');
      const status =
        error instanceof Error && error.message === 'Item unit not found'
          ? 404
          : 500;
      return void res.status(status).json({
        status: 'error',
        message:
          error instanceof Error ? error.message : 'Failed to get item unit',
      });
    }
  }
);

/**
 * POST /api/v1/inventory/item-units
 * Create item unit
 */
router.post(
  '/',
  authorize({ resource: 'item-unit', action: 'edit' }),
  validate({ body: createItemUnitSchema }),
  async (req: AuthRequest, res: Response) => {
    try {
      const companyId = req.companyId || req.tenantId;
      if (!companyId) {
        return void res.status(400).json({
          status: 'error',
          message: 'Company ID is required',
        });
      }

      const itemUnit = await itemUnitService.createItemUnit(
        companyId,
        req.body
      );

      logger.info({ companyId, itemUnitId: itemUnit.id }, 'Item unit created');

      return void res.status(201).json({
        status: 'success',
        message: 'Item unit created successfully',
        data: itemUnit,
      });
    } catch (error) {
      logger.error({ error, body: req.body }, 'Error creating item unit');
      return void res.status(500).json({
        status: 'error',
        message:
          error instanceof Error ? error.message : 'Failed to create item unit',
      });
    }
  }
);

/**
 * PUT /api/v1/inventory/item-units/:id
 * Update item unit
 */
router.put(
  '/:id',
  authorize({ resource: 'item-unit', action: 'edit' }),
  validate({ body: updateItemUnitSchema }),
  async (req: AuthRequest, res: Response) => {
    try {
      const companyId = req.companyId || req.tenantId;
      if (!companyId) {
        return void res.status(400).json({
          status: 'error',
          message: 'Company ID is required',
        });
      }

      const itemUnit = await itemUnitService.updateItemUnit(
        companyId,
        req.params.id,
        req.body
      );

      return void res.json({
        status: 'success',
        message: 'Item unit updated successfully',
        data: itemUnit,
      });
    } catch (error) {
      logger.error({ error, itemUnitId: req.params.id }, 'Error updating item unit');
      const status =
        error instanceof Error && error.message === 'Item unit not found'
          ? 404
          : 500;
      return void res.status(status).json({
        status: 'error',
        message:
          error instanceof Error ? error.message : 'Failed to update item unit',
      });
    }
  }
);

/**
 * DELETE /api/v1/inventory/item-units/:id
 * Delete item unit
 */
router.delete(
  '/:id',
  authorize({ resource: 'item-unit', action: 'delete' }),
  async (req: AuthRequest, res: Response) => {
    try {
      const companyId = req.companyId || req.tenantId;
      if (!companyId) {
        return void res.status(400).json({
          status: 'error',
          message: 'Company ID is required',
        });
      }

      await itemUnitService.deleteItemUnit(companyId, req.params.id);

      return void res.status(204).send();
    } catch (error) {
      logger.error({ error, itemUnitId: req.params.id }, 'Error deleting item unit');
      const status =
        error instanceof Error && error.message === 'Item unit not found'
          ? 404
          : 500;
      return void res.status(status).json({
        status: 'error',
        message:
          error instanceof Error ? error.message : 'Failed to delete item unit',
      });
    }
  }
);

export default router;
