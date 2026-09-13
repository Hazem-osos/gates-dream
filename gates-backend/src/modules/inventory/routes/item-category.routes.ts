import { Router, Response } from 'express';
import { validate } from '../../../shared/middleware/validate';
import { authenticate } from '../../../shared/middleware/auth.middleware';
import { authorize } from '../../../shared/middleware/authorize.middleware';
import { setTenantContext } from '../../../shared/middleware/tenant.middleware';
import { AppError } from '../../../shared/middleware/error-handler';
import {
  createItemCategorySchema,
  updateItemCategorySchema,
  itemCategoryQuerySchema,
} from '../schemas/item-category.schema';
import { itemCategoryService } from '../services/item-category.service';
import { logger } from '../../../shared/logger';
import { AuthRequest } from '../../../shared/auth/types';

const router = Router();

router.use(authenticate);
router.use(setTenantContext);

/**
 * GET /api/v1/inventory/item-categories
 * List item categories — used to populate the category select in the
 * enterprise item quick-add modal and drive GL-account defaulting.
 */
router.get(
  '/',
  authorize({ resource: 'item-category', action: 'view' }),
  validate({ query: itemCategoryQuerySchema }),
  async (req: AuthRequest, res: Response) => {
    try {
      const companyId = req.companyId || req.tenantId;
      if (!companyId) {
        return void res.status(400).json({ status: 'error', message: 'Company ID is required' });
      }

      const result = await itemCategoryService.listItemCategories(companyId, {
        page: req.query.page as number | undefined,
        limit: req.query.limit as number | undefined,
        search: req.query.search as string | undefined,
        isActive: req.query.isActive as boolean | undefined,
      });

      return void res.json({
        status: 'success',
        data: result.categories,
        pagination: result.pagination,
      });
    } catch (error) {
      logger.error({ error }, 'Error listing item categories');
      return void res.status(500).json({
        status: 'error',
        message: error instanceof Error ? error.message : 'Failed to list item categories',
      });
    }
  }
);

/**
 * GET /api/v1/inventory/item-categories/:id
 */
router.get(
  '/:id',
  authorize({ resource: 'item-category', action: 'view' }),
  async (req: AuthRequest, res: Response) => {
    try {
      const companyId = req.companyId || req.tenantId;
      if (!companyId) {
        return void res.status(400).json({ status: 'error', message: 'Company ID is required' });
      }

      const category = await itemCategoryService.getItemCategoryById(companyId, req.params.id);
      return void res.json({ status: 'success', data: category });
    } catch (error) {
      logger.error({ error, categoryId: req.params.id }, 'Error getting item category');
      const status = error instanceof AppError ? error.statusCode : 500;
      return void res.status(status).json({
        status: 'error',
        message: error instanceof Error ? error.message : 'Failed to get item category',
      });
    }
  }
);

/**
 * POST /api/v1/inventory/item-categories
 */
router.post(
  '/',
  authorize({ resource: 'item-category', action: 'edit' }),
  validate({ body: createItemCategorySchema }),
  async (req: AuthRequest, res: Response) => {
    try {
      const companyId = req.companyId || req.tenantId;
      if (!companyId) {
        return void res.status(400).json({ status: 'error', message: 'Company ID is required' });
      }

      const category = await itemCategoryService.createItemCategory(companyId, req.body);

      return void res.status(201).json({
        status: 'success',
        message: 'Item category created successfully',
        data: category,
      });
    } catch (error) {
      logger.error({ error, body: req.body }, 'Error creating item category');
      const status = error instanceof AppError ? error.statusCode : 500;
      return void res.status(status).json({
        status: 'error',
        message: error instanceof Error ? error.message : 'Failed to create item category',
      });
    }
  }
);

/**
 * PUT /api/v1/inventory/item-categories/:id
 */
router.put(
  '/:id',
  authorize({ resource: 'item-category', action: 'edit' }),
  validate({ body: updateItemCategorySchema }),
  async (req: AuthRequest, res: Response) => {
    try {
      const companyId = req.companyId || req.tenantId;
      if (!companyId) {
        return void res.status(400).json({ status: 'error', message: 'Company ID is required' });
      }

      const category = await itemCategoryService.updateItemCategory(
        companyId,
        req.params.id,
        req.body
      );

      return void res.json({
        status: 'success',
        message: 'Item category updated successfully',
        data: category,
      });
    } catch (error) {
      logger.error({ error, categoryId: req.params.id }, 'Error updating item category');
      const status = error instanceof AppError ? error.statusCode : 500;
      return void res.status(status).json({
        status: 'error',
        message: error instanceof Error ? error.message : 'Failed to update item category',
      });
    }
  }
);

/**
 * DELETE /api/v1/inventory/item-categories/:id
 * Soft delete (isActive = false) — categories may still be referenced by
 * existing items, so this never hard-deletes the row.
 */
router.delete(
  '/:id',
  authorize({ resource: 'item-category', action: 'delete' }),
  async (req: AuthRequest, res: Response) => {
    try {
      const companyId = req.companyId || req.tenantId;
      if (!companyId) {
        return void res.status(400).json({ status: 'error', message: 'Company ID is required' });
      }

      await itemCategoryService.updateItemCategory(companyId, req.params.id, { isActive: false });
      return void res.status(204).send();
    } catch (error) {
      logger.error({ error, categoryId: req.params.id }, 'Error deleting item category');
      const status = error instanceof AppError ? error.statusCode : 500;
      return void res.status(status).json({
        status: 'error',
        message: error instanceof Error ? error.message : 'Failed to delete item category',
      });
    }
  }
);

export default router;
