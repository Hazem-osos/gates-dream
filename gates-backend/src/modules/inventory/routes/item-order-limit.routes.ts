import { Router, Response } from 'express';
import { validate } from '../../../shared/middleware/validate';
import { authenticate } from '../../../shared/middleware/auth.middleware';
import { authorize } from '../../../shared/middleware/authorize.middleware';
import { setTenantContext } from '../../../shared/middleware/tenant.middleware';
import {
  createItemOrderLimitSchema,
  updateItemOrderLimitSchema,
  itemOrderLimitQuerySchema,
} from '../schemas/item-order-limit.schema';
import { itemOrderLimitService } from '../services/item-order-limit.service';
import { logger } from '../../../shared/logger';
import { AuthRequest } from '../../../shared/auth/types';

const router = Router();

router.use(authenticate);
router.use(setTenantContext);

router.get(
  '/',
  authorize({ resource: 'item', action: 'view' }),
  validate({ query: itemOrderLimitQuerySchema }),
  async (req: AuthRequest, res: Response) => {
    try {
      const companyId = req.companyId || req.tenantId;
      if (!companyId) {
        return void res.status(400).json({ status: 'error', message: 'Company ID is required' });
      }
      const result = await itemOrderLimitService.list(companyId, {
        page: req.query.page as number | undefined,
        limit: req.query.limit as number | undefined,
        search: req.query.search as string | undefined,
        isActive: req.query.isActive as boolean | undefined,
      });
      return void res.json({
        status: 'success',
        data: result.rows,
        pagination: result.pagination,
      });
    } catch (error) {
      logger.error({ error }, 'Error listing item order limits');
      return void res.status(500).json({
        status: 'error',
        message: error instanceof Error ? error.message : 'تعذر العرض',
      });
    }
  }
);

router.get(
  '/:id',
  authorize({ resource: 'item', action: 'view' }),
  async (req: AuthRequest, res: Response) => {
    try {
      const companyId = req.companyId || req.tenantId;
      if (!companyId) {
        return void res.status(400).json({ status: 'error', message: 'Company ID is required' });
      }
      const row = await itemOrderLimitService.getById(companyId, req.params.id);
      return void res.json({ status: 'success', data: row });
    } catch (error) {
      logger.error({ error }, 'Error getting item order limit');
      const status =
        error instanceof Error && error.message === 'Order limit list not found' ? 404 : 500;
      return void res.status(status).json({
        status: 'error',
        message: error instanceof Error ? error.message : 'تعذر العرض',
      });
    }
  }
);

router.post(
  '/',
  authorize({ resource: 'item', action: 'edit' }),
  validate({ body: createItemOrderLimitSchema }),
  async (req: AuthRequest, res: Response) => {
    try {
      const companyId = req.companyId || req.tenantId;
      if (!companyId) {
        return void res.status(400).json({ status: 'error', message: 'Company ID is required' });
      }
      const row = await itemOrderLimitService.create(companyId, req.body);
      return void res.status(201).json({ status: 'success', data: row });
    } catch (error) {
      logger.error({ error, body: req.body }, 'Error creating item order limit');
      return void res.status(500).json({
        status: 'error',
        message: error instanceof Error ? error.message : 'تعذر الحفظ',
      });
    }
  }
);

router.put(
  '/:id',
  authorize({ resource: 'item', action: 'edit' }),
  validate({ body: updateItemOrderLimitSchema }),
  async (req: AuthRequest, res: Response) => {
    try {
      const companyId = req.companyId || req.tenantId;
      if (!companyId) {
        return void res.status(400).json({ status: 'error', message: 'Company ID is required' });
      }
      const row = await itemOrderLimitService.update(companyId, req.params.id, req.body);
      return void res.json({ status: 'success', data: row });
    } catch (error) {
      logger.error({ error }, 'Error updating item order limit');
      const status =
        error instanceof Error && error.message === 'Order limit list not found' ? 404 : 500;
      return void res.status(status).json({
        status: 'error',
        message: error instanceof Error ? error.message : 'تعذر الحفظ',
      });
    }
  }
);

router.delete(
  '/:id',
  authorize({ resource: 'item', action: 'delete' }),
  async (req: AuthRequest, res: Response) => {
    try {
      const companyId = req.companyId || req.tenantId;
      if (!companyId) {
        return void res.status(400).json({ status: 'error', message: 'Company ID is required' });
      }
      await itemOrderLimitService.remove(companyId, req.params.id);
      return void res.status(204).send();
    } catch (error) {
      logger.error({ error }, 'Error deleting item order limit');
      const status =
        error instanceof Error && error.message === 'Order limit list not found' ? 404 : 500;
      return void res.status(status).json({
        status: 'error',
        message: error instanceof Error ? error.message : 'تعذر الحذف',
      });
    }
  }
);

export default router;
