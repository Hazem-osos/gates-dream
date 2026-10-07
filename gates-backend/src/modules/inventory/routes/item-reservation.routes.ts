import { Router, Response, NextFunction } from 'express';
import { validate } from '../../../shared/middleware/validate';
import { authenticate } from '../../../shared/middleware/auth.middleware';
import { authorize } from '../../../shared/middleware/authorize.middleware';
import { setTenantContext } from '../../../shared/middleware/tenant.middleware';
import { AppError } from '../../../shared/middleware/error-handler';
import {
  createItemReservationSchema,
  itemReservationQuerySchema,
  updateItemReservationSchema,
} from '../schemas/item-reservation.schema';
import { itemReservationService } from '../services/item-reservation.service';
import { AuthRequest } from '../../../shared/auth/types';

function sendError(res: Response, next: NextFunction, error: unknown) {
  if (error instanceof AppError) {
    return void res.status(error.statusCode).json({ status: 'error', message: error.message });
  }
  return next(error);
}

function companyIdOf(req: AuthRequest): string | null {
  return req.companyId || req.tenantId || null;
}

const router = Router();

router.use(authenticate);
router.use(setTenantContext);

router.get(
  '/',
  authorize({ resource: 'invoice', action: 'view' }),
  validate({ query: itemReservationQuerySchema }),
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const companyId = companyIdOf(req);
      if (!companyId) {
        return void res.status(400).json({ status: 'error', message: 'معرّف الشركة مطلوب' });
      }
      const result = await itemReservationService.list(companyId, {
        page: req.query.page as number | undefined,
        limit: req.query.limit as number | undefined,
        warehouseId: req.query.warehouseId as string | undefined,
        itemId: req.query.itemId as string | undefined,
        customerId: req.query.customerId as string | undefined,
        status: req.query.status as 'ACTIVE' | 'RELEASED' | 'ALL' | 'OPEN' | undefined,
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
  authorize({ resource: 'invoice', action: 'view' }),
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const companyId = companyIdOf(req);
      if (!companyId) {
        return void res.status(400).json({ status: 'error', message: 'معرّف الشركة مطلوب' });
      }
      const row = await itemReservationService.getById(companyId, req.params.id);
      return void res.json({ status: 'success', data: row });
    } catch (error) {
      return sendError(res, next, error);
    }
  }
);

router.post(
  '/',
  authorize({ resource: 'invoice', action: 'edit' }),
  validate({ body: createItemReservationSchema }),
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const companyId = companyIdOf(req);
      if (!companyId) {
        return void res.status(400).json({ status: 'error', message: 'معرّف الشركة مطلوب' });
      }
      const row = await itemReservationService.create(companyId, req.body);
      return void res.status(201).json({ status: 'success', data: row });
    } catch (error) {
      return sendError(res, next, error);
    }
  }
);

router.put(
  '/:id',
  authorize({ resource: 'invoice', action: 'edit' }),
  validate({ body: updateItemReservationSchema }),
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const companyId = companyIdOf(req);
      if (!companyId) {
        return void res.status(400).json({ status: 'error', message: 'معرّف الشركة مطلوب' });
      }
      const row = await itemReservationService.update(companyId, req.params.id, req.body);
      return void res.json({ status: 'success', data: row });
    } catch (error) {
      return sendError(res, next, error);
    }
  }
);

router.post(
  '/:id/release',
  authorize({ resource: 'invoice', action: 'edit' }),
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const companyId = companyIdOf(req);
      if (!companyId) {
        return void res.status(400).json({ status: 'error', message: 'معرّف الشركة مطلوب' });
      }
      const row = await itemReservationService.release(companyId, req.params.id);
      return void res.json({ status: 'success', data: row });
    } catch (error) {
      return sendError(res, next, error);
    }
  }
);

export default router;
