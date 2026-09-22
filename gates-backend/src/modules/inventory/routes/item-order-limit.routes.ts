import { Router, Response, NextFunction } from 'express';
import { validate } from '../../../shared/middleware/validate';
import { authenticate } from '../../../shared/middleware/auth.middleware';
import { authorize } from '../../../shared/middleware/authorize.middleware';
import { setTenantContext } from '../../../shared/middleware/tenant.middleware';
import { AppError } from '../../../shared/middleware/error-handler';
import {
  createItemOrderLimitSchema,
  updateItemOrderLimitSchema,
  itemOrderLimitQuerySchema,
} from '../schemas/item-order-limit.schema';
import { itemOrderLimitService } from '../services/item-order-limit.service';
import { AuthRequest } from '../../../shared/auth/types';

function sendError(res: Response, next: NextFunction, error: unknown) {
  if (error instanceof AppError) {
    return void res.status(error.statusCode).json({ status: 'error', message: error.message });
  }
  return next(error);
}

const router = Router();

router.use(authenticate);
router.use(setTenantContext);

router.get(
  '/',
  authorize({ resource: 'item', action: 'view' }),
  validate({ query: itemOrderLimitQuerySchema }),
  async (req: AuthRequest, res: Response, next: NextFunction) => {
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
        warehouseId: req.query.warehouseId as string | undefined,
      });
      return void res.json({
        status: 'success',
        data: result.rows,
        pagination: result.pagination,
      });
    } catch (error) {
      return sendError(res, next, error);
    }
  }
);

router.get(
  '/:id',
  authorize({ resource: 'item', action: 'view' }),
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const companyId = req.companyId || req.tenantId;
      if (!companyId) {
        return void res.status(400).json({ status: 'error', message: 'Company ID is required' });
      }
      const row = await itemOrderLimitService.getById(companyId, req.params.id);
      return void res.json({ status: 'success', data: row });
    } catch (error) {
      return sendError(res, next, error);
    }
  }
);

router.post(
  '/',
  authorize({ resource: 'item', action: 'edit' }),
  validate({ body: createItemOrderLimitSchema }),
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const companyId = req.companyId || req.tenantId;
      if (!companyId) {
        return void res.status(400).json({ status: 'error', message: 'Company ID is required' });
      }
      const row = await itemOrderLimitService.create(companyId, req.body);
      return void res.status(201).json({ status: 'success', data: row });
    } catch (error) {
      return sendError(res, next, error);
    }
  }
);

router.put(
  '/:id',
  authorize({ resource: 'item', action: 'edit' }),
  validate({ body: updateItemOrderLimitSchema }),
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const companyId = req.companyId || req.tenantId;
      if (!companyId) {
        return void res.status(400).json({ status: 'error', message: 'Company ID is required' });
      }
      const row = await itemOrderLimitService.update(companyId, req.params.id, req.body);
      return void res.json({ status: 'success', data: row });
    } catch (error) {
      return sendError(res, next, error);
    }
  }
);

router.delete(
  '/:id',
  authorize({ resource: 'item', action: 'delete' }),
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const companyId = req.companyId || req.tenantId;
      if (!companyId) {
        return void res.status(400).json({ status: 'error', message: 'Company ID is required' });
      }
      await itemOrderLimitService.remove(companyId, req.params.id);
      return void res.status(204).send();
    } catch (error) {
      return sendError(res, next, error);
    }
  }
);

export default router;
