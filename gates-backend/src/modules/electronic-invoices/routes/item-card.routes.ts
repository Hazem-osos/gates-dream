import { Router, Response } from 'express';
import { validate } from '../../../shared/middleware/validate';
import { authenticate } from '../../../shared/middleware/auth.middleware';
import { authorize } from '../../../shared/middleware/authorize.middleware';
import { setTenantContext } from '../../../shared/middleware/tenant.middleware';
import {
  createElectronicInvoiceItemSchema,
  updateElectronicInvoiceItemSchema,
  electronicInvoiceItemQuerySchema,
} from '../schemas/item-card.schema';
import { electronicInvoiceItemService } from '../services/item-card.service';
import { logger } from '../../../shared/logger';
import { AuthRequest } from '../../../shared/auth/types';

const router = Router();

router.use(authenticate);
router.use(setTenantContext);

router.get(
  '/',
  authorize({ resource: 'electronic-invoice', action: 'view' }),
  validate({ query: electronicInvoiceItemQuerySchema }),
  async (req: AuthRequest, res: Response) => {
    try {
      const companyId = req.companyId || req.tenantId;
      if (!companyId) {
        return void res.status(400).json({
          status: 'error',
          message: 'Company ID is required',
        });
      }

      const result = await electronicInvoiceItemService.listItems(companyId, {
        page: req.query.page as number | undefined,
        limit: req.query.limit as number | undefined,
        search: req.query.search as string | undefined,
        isActive: req.query.isActive as boolean | undefined,
      });

      return void res.json({
        status: 'success',
        data: result.items,
        pagination: result.pagination,
      });
    } catch (error) {
      logger.error({ error }, 'Error listing electronic invoice items');
      return void res.status(500).json({
        status: 'error',
        message: error instanceof Error ? error.message : 'Failed to list electronic invoice items',
      });
    }
  }
);

router.get(
  '/:id',
  authorize({ resource: 'electronic-invoice', action: 'view' }),
  async (req: AuthRequest, res: Response) => {
    try {
      const companyId = req.companyId || req.tenantId;
      if (!companyId) {
        return void res.status(400).json({
          status: 'error',
          message: 'Company ID is required',
        });
      }

      const item = await electronicInvoiceItemService.getItemById(companyId, req.params.id);

      return void res.json({
        status: 'success',
        data: item,
      });
    } catch (error) {
      logger.error({ error }, 'Error getting electronic invoice item');
      const status =
        error instanceof Error && error.message === 'Electronic invoice item not found' ? 404 : 500;
      return void res.status(status).json({
        status: 'error',
        message: error instanceof Error ? error.message : 'Failed to get electronic invoice item',
      });
    }
  }
);

router.post(
  '/',
  authorize({ resource: 'electronic-invoice', action: 'edit' }),
  validate({ body: createElectronicInvoiceItemSchema }),
  async (req: AuthRequest, res: Response) => {
    try {
      const companyId = req.companyId || req.tenantId;
      if (!companyId) {
        return void res.status(400).json({
          status: 'error',
          message: 'Company ID is required',
        });
      }

      const item = await electronicInvoiceItemService.createItem(companyId, req.body);

      return void res.status(201).json({
        status: 'success',
        message: 'Electronic invoice item created successfully',
        data: item,
      });
    } catch (error) {
      logger.error({ error }, 'Error creating electronic invoice item');
      return void res.status(500).json({
        status: 'error',
        message: error instanceof Error ? error.message : 'Failed to create electronic invoice item',
      });
    }
  }
);

router.put(
  '/:id',
  authorize({ resource: 'electronic-invoice', action: 'edit' }),
  validate({ body: updateElectronicInvoiceItemSchema }),
  async (req: AuthRequest, res: Response) => {
    try {
      const companyId = req.companyId || req.tenantId;
      if (!companyId) {
        return void res.status(400).json({
          status: 'error',
          message: 'Company ID is required',
        });
      }

      const item = await electronicInvoiceItemService.updateItem(
        companyId,
        req.params.id,
        req.body
      );

      return void res.json({
        status: 'success',
        message: 'Electronic invoice item updated successfully',
        data: item,
      });
    } catch (error) {
      logger.error({ error }, 'Error updating electronic invoice item');
      const status =
        error instanceof Error && error.message === 'Electronic invoice item not found' ? 404 : 500;
      return void res.status(status).json({
        status: 'error',
        message: error instanceof Error ? error.message : 'Failed to update electronic invoice item',
      });
    }
  }
);

router.delete(
  '/:id',
  authorize({ resource: 'electronic-invoice', action: 'delete' }),
  async (req: AuthRequest, res: Response) => {
    try {
      const companyId = req.companyId || req.tenantId;
      if (!companyId) {
        return void res.status(400).json({
          status: 'error',
          message: 'Company ID is required',
        });
      }

      await electronicInvoiceItemService.deleteItem(companyId, req.params.id);

      return void res.status(204).send();
    } catch (error) {
      logger.error({ error }, 'Error deleting electronic invoice item');
      const status =
        error instanceof Error && error.message === 'Electronic invoice item not found' ? 404 : 500;
      return void res.status(status).json({
        status: 'error',
        message: error instanceof Error ? error.message : 'Failed to delete electronic invoice item',
      });
    }
  }
);

export default router;

