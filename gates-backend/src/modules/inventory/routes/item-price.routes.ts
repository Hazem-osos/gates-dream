import { Router, Response } from 'express';
import { validate } from '../../../shared/middleware/validate';
import { authenticate } from '../../../shared/middleware/auth.middleware';
import { authorize } from '../../../shared/middleware/authorize.middleware';
import { setTenantContext } from '../../../shared/middleware/tenant.middleware';
import {
  createItemPriceSchema,
  updateItemPriceSchema,
  itemPriceQuerySchema,
} from '../schemas/item-price.schema';
import { itemPriceService } from '../services/item-price.service';
import { logger } from '../../../shared/logger';
import { AuthRequest } from '../../../shared/auth/types';

const router = Router();

router.use(authenticate);
router.use(setTenantContext);

/**
 * GET /api/v1/inventory/item-prices
 * List item prices with pagination and filters
 */
router.get(
  '/',
  authorize({ resource: 'item-price', action: 'view' }),
  validate({ query: itemPriceQuerySchema }),
  async (req: AuthRequest, res: Response) => {
    try {
      const companyId = req.companyId || req.tenantId;
      if (!companyId) {
        return void res.status(400).json({
          status: 'error',
          message: 'Company ID is required',
        });
      }

      const result = await itemPriceService.listItemPrices(companyId, {
        page: req.query.page as number | undefined,
        limit: req.query.limit as number | undefined,
        search: req.query.search as string | undefined,
        itemId: req.query.itemId as string | undefined,
        priceListId: req.query.priceListId as string | undefined,
        unitId: req.query.unitId as string | undefined,
      });

      logger.info(
        { companyId, count: result.itemPrices.length },
        'Item prices listed'
      );

      return void res.json({
        status: 'success',
        data: result.itemPrices,
        pagination: result.pagination,
      });
    } catch (error) {
      logger.error({ error }, 'Error listing item prices');
      return void res.status(500).json({
        status: 'error',
        message:
          error instanceof Error ? error.message : 'Failed to list item prices',
      });
    }
  }
);

/**
 * GET /api/v1/inventory/item-prices/:id
 * Get item price by ID
 */
router.get(
  '/:id',
  authorize({ resource: 'item-price', action: 'view' }),
  async (req: AuthRequest, res: Response) => {
    try {
      const companyId = req.companyId || req.tenantId;
      if (!companyId) {
        return void res.status(400).json({
          status: 'error',
          message: 'Company ID is required',
        });
      }

      const itemPrice = await itemPriceService.getItemPriceById(
        companyId,
        req.params.id
      );

      return void res.json({
        status: 'success',
        data: itemPrice,
      });
    } catch (error) {
      logger.error({ error }, 'Error getting item price');
      const status =
        error instanceof Error && error.message === 'Item price not found'
          ? 404
          : 500;
      return void res.status(status).json({
        status: 'error',
        message:
          error instanceof Error ? error.message : 'Failed to get item price',
      });
    }
  }
);

/**
 * GET /api/v1/inventory/item-prices/item/:itemId/price-list/:priceListId/unit/:unitId
 * Get item price by item, price list, and unit
 */
router.get(
  '/item/:itemId/price-list/:priceListId/unit/:unitId',
  authorize({ resource: 'item-price', action: 'view' }),
  async (req: AuthRequest, res: Response) => {
    try {
      const companyId = req.companyId || req.tenantId;
      if (!companyId) {
        return void res.status(400).json({
          status: 'error',
          message: 'Company ID is required',
        });
      }

      const itemPrice = await itemPriceService.getItemPriceByKeys(
        companyId,
        req.params.itemId,
        req.params.priceListId,
        req.params.unitId
      );

      return void res.json({
        status: 'success',
        data: itemPrice,
      });
    } catch (error) {
      logger.error({ error }, 'Error getting item price by keys');
      const status =
        error instanceof Error && error.message === 'Item price not found'
          ? 404
          : 500;
      return void res.status(status).json({
        status: 'error',
        message:
          error instanceof Error ? error.message : 'Failed to get item price',
      });
    }
  }
);

/**
 * POST /api/v1/inventory/item-prices
 * Create item price
 */
router.post(
  '/',
  authorize({ resource: 'item-price', action: 'edit' }),
  validate({ body: createItemPriceSchema }),
  async (req: AuthRequest, res: Response) => {
    try {
      const companyId = req.companyId || req.tenantId;
      if (!companyId) {
        return void res.status(400).json({
          status: 'error',
          message: 'Company ID is required',
        });
      }

      const itemPrice = await itemPriceService.createItemPrice(
        companyId,
        req.body
      );

      logger.info({ companyId, itemPriceId: itemPrice.id }, 'Item price created');

      return void res.status(201).json({
        status: 'success',
        message: 'Item price created successfully',
        data: itemPrice,
      });
    } catch (error) {
      logger.error({ error, body: req.body }, 'Error creating item price');
      return void res.status(500).json({
        status: 'error',
        message:
          error instanceof Error ? error.message : 'Failed to create item price',
      });
    }
  }
);

/**
 * PUT /api/v1/inventory/item-prices/:id
 * Update item price
 */
router.put(
  '/:id',
  authorize({ resource: 'item-price', action: 'edit' }),
  validate({ body: updateItemPriceSchema }),
  async (req: AuthRequest, res: Response) => {
    try {
      const companyId = req.companyId || req.tenantId;
      if (!companyId) {
        return void res.status(400).json({
          status: 'error',
          message: 'Company ID is required',
        });
      }

      const itemPrice = await itemPriceService.updateItemPrice(
        companyId,
        req.params.id,
        req.body
      );

      return void res.json({
        status: 'success',
        message: 'Item price updated successfully',
        data: itemPrice,
      });
    } catch (error) {
      logger.error({ error, itemPriceId: req.params.id }, 'Error updating item price');
      const status =
        error instanceof Error && error.message === 'Item price not found'
          ? 404
          : 500;
      return void res.status(status).json({
        status: 'error',
        message:
          error instanceof Error ? error.message : 'Failed to update item price',
      });
    }
  }
);

/**
 * DELETE /api/v1/inventory/item-prices/:id
 * Delete item price
 */
router.delete(
  '/:id',
  authorize({ resource: 'item-price', action: 'delete' }),
  async (req: AuthRequest, res: Response) => {
    try {
      const companyId = req.companyId || req.tenantId;
      if (!companyId) {
        return void res.status(400).json({
          status: 'error',
          message: 'Company ID is required',
        });
      }

      await itemPriceService.deleteItemPrice(companyId, req.params.id);

      return void res.status(204).send();
    } catch (error) {
      logger.error({ error, itemPriceId: req.params.id }, 'Error deleting item price');
      const status =
        error instanceof Error && error.message === 'Item price not found'
          ? 404
          : 500;
      return void res.status(status).json({
        status: 'error',
        message:
          error instanceof Error ? error.message : 'Failed to delete item price',
      });
    }
  }
);

export default router;
