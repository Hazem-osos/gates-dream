import { Router, Response } from 'express';
import { validate } from '../../../shared/middleware/validate';
import { authenticate } from '../../../shared/middleware/auth.middleware';
import { authorize } from '../../../shared/middleware/authorize.middleware';
import { setTenantContext } from '../../../shared/middleware/tenant.middleware';
import {
  createItemSchema,
  updateItemSchema,
  itemQuerySchema,
  findItemByBarcodeQuerySchema,
  itemFinderQuerySchema,
  bomExplosionQuerySchema,
} from '../schemas/item.schema';
import { itemService } from '../services/item.service';
import { itemBomExplosionService } from '../services/item-bom-explosion.service';
import { demoCatalogService } from '../services/demo-catalog.service';
import { logger } from '../../../shared/logger';
import { AuthRequest } from '../../../shared/auth/types';
import { getMasterCatalogEtag } from '../../../shared/services/master-catalog-version.service';
import { sendJsonWithEtag } from '../../../shared/http/master-data-etag';
import { traceAudit } from '../../../shared/middleware/trace-audit.middleware';
import { AppError } from '../../../shared/middleware/error-handler';
import { itemPricingPolicyQuerySchema } from '../../transaction-settings/transaction-settings.schema';
import { resolveItemPricingPolicy } from '../../transaction-settings/item-pricing-policy.service';
import { refuseProductionSeed } from '../../../shared/config/prod-seed';

const router = Router();

// All routes require authentication and tenant context
router.use(authenticate);
router.use(setTenantContext);
// Legacy `Save_Trace` equivalent — legacy menu item `mnsmItem`.
router.use(traceAudit('mnsmItem'));

/**
 * GET /api/v1/inventory/items
 * List items with pagination and filters
 */
router.get(
  '/',
  authorize({ resource: 'item', action: 'view' }),
  validate({ query: itemQuerySchema }),
  async (req: AuthRequest, res: Response) => {
    try {
      const companyId = req.companyId || req.tenantId;
      if (!companyId) {
        return void res.status(400).json({
          status: 'error',
          message: 'Company ID is required',
        });
      }

      const result = await itemService.listItems(companyId, {
        page: req.query.page as number | undefined,
        limit: req.query.limit as number | undefined,
        search: req.query.search as string | undefined,
        itemType: req.query.itemType as string | undefined,
        categoryId: req.query.categoryId as string | undefined,
        isActive: req.query.isActive as boolean | undefined,
        isAssembly: req.query.isAssembly as boolean | undefined,
      });

      logger.info(
        { companyId, count: result.items.length },
        'Items listed'
      );

      const etag = await getMasterCatalogEtag(companyId, 'item');
      sendJsonWithEtag(req, res, etag, {
        status: 'success',
        data: result.items,
        pagination: result.pagination,
      });
    } catch (error) {
      logger.error({ error }, 'Error listing items');
      return void res.status(500).json({
        status: 'error',
        message:
          error instanceof Error ? error.message : 'Failed to list items',
      });
    }
  }
);

/**
 * POST /api/v1/inventory/items/seed-demo-catalog
 * Demo item (صنف تجريبي) + unit + stock + demo customer for invoicing
 */
router.post(
  '/seed-demo-catalog',
  authorize({ resource: 'item', action: 'edit' }),
  async (req: AuthRequest, res: Response) => {
    if (refuseProductionSeed()) {
      return void res.status(403).json({
        status: 'error',
        message: 'تهيئة البيانات التجريبية معطلة على بيئة التشغيل',
      });
    }

    try {
      const companyId = req.companyId || req.tenantId;
      if (!companyId) {
        return void res.status(400).json({
          status: 'error',
          message: 'Company ID is required',
        });
      }

      const data = await demoCatalogService.ensureDemoCatalog(companyId);

      logger.info({ companyId, ...data }, 'Demo catalog ensured');

      return void res.json({
        status: 'success',
        message: 'تم إنشاء الصنف التجريبي والعميل التجريبي (إن لم يكونا موجودين)',
        data,
      });
    } catch (error) {
      logger.error({ error }, 'Error seeding demo catalog');
      return void res.status(500).json({
        status: 'error',
        message: error instanceof Error ? error.message : 'Failed to seed demo catalog',
      });
    }
  }
);

/**
 * GET /api/v1/inventory/items/find-by-barcode?barcode=
 * Exact barcode / serial lookup for invoice line scanners.
 */
router.get(
  '/find-by-barcode',
  authorize({ resource: 'item', action: 'view' }),
  validate({ query: findItemByBarcodeQuerySchema }),
  async (req: AuthRequest, res: Response) => {
    try {
      const companyId = req.companyId || req.tenantId;
      if (!companyId) {
        return void res.status(400).json({
          status: 'error',
          message: 'Company ID is required',
        });
      }

      const barcode = String(req.query.barcode ?? '');
      const item = await itemService.findItemByBarcode(companyId, barcode);
      return void res.json({
        status: 'success',
        data: item,
      });
    } catch (error) {
      const status = error instanceof AppError ? error.statusCode : 500;
      if (status >= 500) {
        logger.error({ error }, 'Error finding item by barcode');
      }
      return void res.status(status).json({
        status: 'error',
        message:
          error instanceof Error ? error.message : 'Failed to find item by barcode',
      });
    }
  }
);

/**
 * GET /api/v1/inventory/items/finder
 * Item card barcode search: barcode / name / price range + warehouse qty.
 */
router.get(
  '/finder',
  authorize({ resource: 'item', action: 'view' }),
  validate({ query: itemFinderQuerySchema }),
  async (req: AuthRequest, res: Response) => {
    try {
      const companyId = req.companyId || req.tenantId;
      if (!companyId) {
        return void res.status(400).json({
          status: 'error',
          message: 'Company ID is required',
        });
      }
      const result = await itemService.searchItemFinder(companyId, {
        barcode: req.query.barcode as string | undefined,
        name: req.query.name as string | undefined,
        purchaseOp: req.query.purchaseOp as 'none' | 'eq' | 'gt' | 'lt' | 'between' | undefined,
        purchaseFrom: req.query.purchaseFrom as number | undefined,
        purchaseTo: req.query.purchaseTo as number | undefined,
        saleOp: req.query.saleOp as 'none' | 'eq' | 'gt' | 'lt' | 'between' | undefined,
        saleFrom: req.query.saleFrom as number | undefined,
        saleTo: req.query.saleTo as number | undefined,
        limit: req.query.limit as number | undefined,
      });
      return void res.json({ status: 'success', data: result.rows });
    } catch (error) {
      logger.error({ error }, 'Error searching item finder');
      return void res.status(500).json({
        status: 'error',
        message: error instanceof Error ? error.message : 'تعذر البحث',
      });
    }
  }
);

/**
 * GET /api/v1/inventory/items/:id/bom-explosion?quantity=&warehouseId=
 * Explode the active BOM for an assembled parent item.
 */
router.get(
  '/:id/bom-explosion',
  authorize({ resource: 'item', action: 'view' }),
  validate({ query: bomExplosionQuerySchema }),
  async (req: AuthRequest, res: Response) => {
    try {
      const companyId = req.companyId || req.tenantId;
      if (!companyId) {
        return void res.status(400).json({
          status: 'error',
          message: 'Company ID is required',
        });
      }
      const data = await itemBomExplosionService.explode(
        companyId,
        req.params.id,
        Number(req.query.quantity ?? 1),
        req.query.warehouseId as string | undefined
      );
      return void res.json({ status: 'success', data });
    } catch (error) {
      const status = error instanceof AppError ? error.statusCode : 500;
      if (status >= 500) logger.error({ error }, 'Error exploding item BOM');
      return void res.status(status).json({
        status: 'error',
        message: error instanceof Error ? error.message : 'Failed to explode BOM',
      });
    }
  }
);

/**
 * GET /api/v1/inventory/items/:id/disassembly-explosion?quantity=&warehouseId=&sourceWarehouseId=
 * Reverse-explode BOM and allocate parent MAC across resulting components.
 */
router.get(
  '/:id/disassembly-explosion',
  authorize({ resource: 'item', action: 'view' }),
  validate({ query: bomExplosionQuerySchema }),
  async (req: AuthRequest, res: Response) => {
    try {
      const companyId = req.companyId || req.tenantId;
      if (!companyId) {
        return void res.status(400).json({
          status: 'error',
          message: 'Company ID is required',
        });
      }
      const data = await itemBomExplosionService.explodeForDisassembly(
        companyId,
        req.params.id,
        Number(req.query.quantity ?? 1),
        req.query.warehouseId as string | undefined,
        req.query.sourceWarehouseId as string | undefined
      );
      return void res.json({ status: 'success', data });
    } catch (error) {
      const status = error instanceof AppError ? error.statusCode : 500;
      if (status >= 500) logger.error({ error }, 'Error exploding disassembly BOM');
      return void res.status(status).json({
        status: 'error',
        message: error instanceof Error ? error.message : 'Failed to explode disassembly BOM',
      });
    }
  }
);

/**
 * GET /api/v1/inventory/items/:itemId/pricing-policy
 */
router.get(
  '/:itemId/pricing-policy',
  authorize({ resource: 'item', action: 'view' }),
  validate({ query: itemPricingPolicyQuerySchema }),
  async (req: AuthRequest, res: Response) => {
    try {
      const companyId = req.companyId || req.tenantId;
      if (!companyId) {
        return void res.status(400).json({ status: 'error', message: 'Company ID is required' });
      }
      const data = await resolveItemPricingPolicy({
        companyId,
        itemId: String(req.params.itemId),
        customerId: req.query.customerId as string | undefined,
        priceListId: req.query.priceListId as string | undefined,
        unitId: req.query.unitId as string | undefined,
        policy: req.query.policy as never,
      });
      return void res.json({ status: 'success', data });
    } catch (error) {
      const status = error instanceof AppError ? error.statusCode : 500;
      return void res.status(status).json({
        status: 'error',
        message: error instanceof Error ? error.message : 'Failed to resolve pricing policy',
      });
    }
  }
);

/**
 * GET /api/v1/inventory/items/:id
 * Get item by ID
 */
router.get(
  '/:id',
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

      const item = await itemService.getItemById(companyId, req.params.id);

      return void res.json({
        status: 'success',
        data: item,
      });
    } catch (error) {
      logger.error({ error, itemId: req.params.id }, 'Error getting item');
      const status =
        error instanceof Error && error.message === 'Item not found'
          ? 404
          : 500;
      return void res.status(status).json({
        status: 'error',
        message:
          error instanceof Error ? error.message : 'Failed to get item',
      });
    }
  }
);

/**
 * POST /api/v1/inventory/items
 * Create item
 */
router.post(
  '/',
  authorize({ resource: 'item', action: 'edit' }),
  validate({ body: createItemSchema }),
  async (req: AuthRequest, res: Response) => {
    try {
      const companyId = req.companyId || req.tenantId;
      if (!companyId) {
        return void res.status(400).json({
          status: 'error',
          message: 'Company ID is required',
        });
      }

      const item = await itemService.createItem(companyId, req.body);

      logger.info({ companyId, itemId: item.id }, 'Item created');

      return void res.status(201).json({
        status: 'success',
        message: 'Item created successfully',
        data: item,
      });
    } catch (error) {
      logger.error({ error, body: req.body }, 'Error creating item');
      return void res.status(500).json({
        status: 'error',
        message:
          error instanceof Error ? error.message : 'Failed to create item',
      });
    }
  }
);

/**
 * PUT /api/v1/inventory/items/:id
 * Update item
 */
router.put(
  '/:id',
  authorize({ resource: 'item', action: 'edit' }),
  validate({ body: updateItemSchema }),
  async (req: AuthRequest, res: Response) => {
    try {
      const companyId = req.companyId || req.tenantId;
      if (!companyId) {
        return void res.status(400).json({
          status: 'error',
          message: 'Company ID is required',
        });
      }

      const item = await itemService.updateItem(
        companyId,
        req.params.id,
        req.body
      );

      return void res.json({
        status: 'success',
        message: 'Item updated successfully',
        data: item,
      });
    } catch (error) {
      logger.error({ error, itemId: req.params.id }, 'Error updating item');
      const status =
        error instanceof Error && error.message === 'Item not found'
          ? 404
          : 500;
      return void res.status(status).json({
        status: 'error',
        message:
          error instanceof Error ? error.message : 'Failed to update item',
      });
    }
  }
);

/**
 * DELETE /api/v1/inventory/items/:id
 * Permanent delete — blocked when the item has movements or documents.
 */
router.delete(
  '/:id',
  authorize({ resource: 'item', action: 'delete' }),
  async (req: AuthRequest, res: Response) => {
    try {
      const companyId = req.companyId || req.tenantId;
      if (!companyId) {
        return void res.status(400).json({
          status: 'error',
          message: 'Company ID is required',
        });
      }

      await itemService.deleteItem(companyId, req.params.id);

      return void res.status(204).send();
    } catch (error) {
      logger.error({ error, itemId: req.params.id }, 'Error deleting item');
      const status = error instanceof AppError ? error.statusCode : 500;
      return void res.status(status).json({
        status: 'error',
        message:
          error instanceof Error ? error.message : 'Failed to delete item',
      });
    }
  }
);

export default router;