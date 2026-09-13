import { Router, Response } from 'express';
import { validate } from '../../../shared/middleware/validate';
import { authenticate } from '../../../shared/middleware/auth.middleware';
import { authorize } from '../../../shared/middleware/authorize.middleware';
import { setTenantContext } from '../../../shared/middleware/tenant.middleware';
import {
  createPriceListSchema,
  updatePriceListSchema,
  priceListQuerySchema,
  upsertPriceListPricesSchema,
} from '../schemas/price-list.schema';
import { priceListService } from '../services/price-list.service';
import { logger } from '../../../shared/logger';
import { AuthRequest } from '../../../shared/auth/types';

const router = Router();

router.use(authenticate);
router.use(setTenantContext);

/**
 * GET /api/v1/inventory/price-lists
 * List price lists with pagination and filters
 */
router.get(
  '/',
  authorize({ resource: 'price-list', action: 'view' }),
  validate({ query: priceListQuerySchema }),
  async (req: AuthRequest, res: Response) => {
    try {
      const companyId = req.companyId || req.tenantId;
      if (!companyId) {
        return void res.status(400).json({
          status: 'error',
          message: 'Company ID is required',
        });
      }

      const result = await priceListService.listPriceLists(companyId, {
        page: req.query.page as number | undefined,
        limit: req.query.limit as number | undefined,
        search: req.query.search as string | undefined,
        isActive: req.query.isActive as boolean | undefined,
      });

      logger.info(
        { companyId, count: result.priceLists.length },
        'Price lists listed'
      );

      return void res.json({
        status: 'success',
        data: result.priceLists,
        pagination: result.pagination,
      });
    } catch (error) {
      logger.error({ error }, 'Error listing price lists');
      return void res.status(500).json({
        status: 'error',
        message:
          error instanceof Error
            ? error.message
            : 'Failed to list price lists',
      });
    }
  }
);

/**
 * GET /api/v1/inventory/price-lists/:id
 * Get price list by ID
 */
router.get(
  '/:id',
  authorize({ resource: 'price-list', action: 'view' }),
  async (req: AuthRequest, res: Response) => {
    try {
      const companyId = req.companyId || req.tenantId;
      if (!companyId) {
        return void res.status(400).json({
          status: 'error',
          message: 'Company ID is required',
        });
      }

      const priceList = await priceListService.getPriceListById(
        companyId,
        req.params.id
      );

      return void res.json({
        status: 'success',
        data: priceList,
      });
    } catch (error) {
      logger.error({ error }, 'Error getting price list');
      const status =
        error instanceof Error && error.message === 'Price list not found'
          ? 404
          : 500;
      return void res.status(status).json({
        status: 'error',
        message:
          error instanceof Error ? error.message : 'Failed to get price list',
      });
    }
  }
);

/**
 * POST /api/v1/inventory/price-lists
 * Create price list
 */
router.post(
  '/',
  authorize({ resource: 'price-list', action: 'edit' }),
  validate({ body: createPriceListSchema }),
  async (req: AuthRequest, res: Response) => {
    try {
      const companyId = req.companyId || req.tenantId;
      if (!companyId) {
        return void res.status(400).json({
          status: 'error',
          message: 'Company ID is required',
        });
      }

      const priceList = await priceListService.createPriceList(
        companyId,
        req.body
      );

      logger.info({ companyId, priceListId: priceList.id }, 'Price list created');

      return void res.status(201).json({
        status: 'success',
        message: 'Price list created successfully',
        data: priceList,
      });
    } catch (error) {
      logger.error({ error, body: req.body }, 'Error creating price list');
      return void res.status(500).json({
        status: 'error',
        message:
          error instanceof Error ? error.message : 'Failed to create price list',
      });
    }
  }
);

/**
 * PUT /api/v1/inventory/price-lists/:id
 * Update price list
 */
router.put(
  '/:id',
  authorize({ resource: 'price-list', action: 'edit' }),
  validate({ body: updatePriceListSchema }),
  async (req: AuthRequest, res: Response) => {
    try {
      const companyId = req.companyId || req.tenantId;
      if (!companyId) {
        return void res.status(400).json({
          status: 'error',
          message: 'Company ID is required',
        });
      }

      const priceList = await priceListService.updatePriceList(
        companyId,
        req.params.id,
        req.body
      );

      return void res.json({
        status: 'success',
        message: 'Price list updated successfully',
        data: priceList,
      });
    } catch (error) {
      logger.error({ error, priceListId: req.params.id }, 'Error updating price list');
      const status =
        error instanceof Error && error.message === 'Price list not found'
          ? 404
          : 500;
      return void res.status(status).json({
        status: 'error',
        message:
          error instanceof Error ? error.message : 'Failed to update price list',
      });
    }
  }
);

/**
 * PUT /api/v1/inventory/price-lists/:id/prices
 * Bulk upsert prices for a list
 */
router.put(
  '/:id/prices',
  authorize({ resource: 'price-list', action: 'edit' }),
  validate({ body: upsertPriceListPricesSchema }),
  async (req: AuthRequest, res: Response) => {
    try {
      const companyId = req.companyId || req.tenantId;
      if (!companyId) {
        return void res.status(400).json({
          status: 'error',
          message: 'Company ID is required',
        });
      }

      const priceList = await priceListService.upsertPrices(
        companyId,
        req.params.id,
        req.body.prices,
        Boolean(req.body.replace)
      );

      return void res.json({
        status: 'success',
        message: 'Price list prices updated successfully',
        data: priceList,
      });
    } catch (error) {
      logger.error({ error, priceListId: req.params.id }, 'Error upserting price list prices');
      const status =
        error instanceof Error && error.message === 'Price list not found'
          ? 404
          : 500;
      return void res.status(status).json({
        status: 'error',
        message:
          error instanceof Error ? error.message : 'Failed to update prices',
      });
    }
  }
);

/**
 * DELETE /api/v1/inventory/price-lists/:id
 * Delete price list (soft delete)
 */
router.delete(
  '/:id',
  authorize({ resource: 'price-list', action: 'delete' }),
  async (req: AuthRequest, res: Response) => {
    try {
      const companyId = req.companyId || req.tenantId;
      if (!companyId) {
        return void res.status(400).json({
          status: 'error',
          message: 'Company ID is required',
        });
      }

      await priceListService.deletePriceList(companyId, req.params.id);

      return void res.status(204).send();
    } catch (error) {
      logger.error({ error, priceListId: req.params.id }, 'Error deleting price list');
      const status =
        error instanceof Error && error.message === 'Price list not found'
          ? 404
          : 500;
      return void res.status(status).json({
        status: 'error',
        message:
          error instanceof Error ? error.message : 'Failed to delete price list',
      });
    }
  }
);

export default router;
