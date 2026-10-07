import { Router, Response } from 'express';
import { validate } from '../../../shared/middleware/validate';
import { authenticate } from '../../../shared/middleware/auth.middleware';
import { authorize } from '../../../shared/middleware/authorize.middleware';
import { setTenantContext } from '../../../shared/middleware/tenant.middleware';
import { AuthRequest } from '../../../shared/auth/types';
import { AppError } from '../../../shared/middleware/error-handler';
import {
  createSupplyOrderSchema,
  supplyOrderFollowUpQuerySchema,
  supplyOrderQuerySchema,
} from '../schemas/supply-order.schema';
import { supplyOrderService } from '../services/supply-order.service';

const router = Router();

router.use(authenticate);
router.use(setTenantContext);

router.get(
  '/reports/follow-up',
  authorize({ resource: 'invoice', action: 'view' }),
  validate({ query: supplyOrderFollowUpQuerySchema }),
  async (req: AuthRequest, res: Response) => {
    const companyId = req.companyId || req.tenantId;
    if (!companyId) {
      return void res.status(400).json({ status: 'error', message: 'معرّف الشركة مطلوب' });
    }
    const result = await supplyOrderService.followUpReport(companyId, req.query as never);
    return void res.json({ status: 'success', data: result });
  }
);

router.get(
  '/',
  authorize({ resource: 'invoice', action: 'view' }),
  validate({ query: supplyOrderQuerySchema }),
  async (req: AuthRequest, res: Response) => {
    const companyId = req.companyId || req.tenantId;
    if (!companyId) {
      return void res.status(400).json({ status: 'error', message: 'معرّف الشركة مطلوب' });
    }
    const page = req.query.page ? parseInt(String(req.query.page), 10) : 1;
    const limit = req.query.limit ? parseInt(String(req.query.limit), 10) : 50;
    const result = await supplyOrderService.list(companyId, {
      customerId: req.query.customerId as string | undefined,
      isClosed: req.query.isClosed as boolean | undefined,
      isCancelled: req.query.isCancelled as boolean | undefined,
      fromDate: req.query.fromDate as string | undefined,
      toDate: req.query.toDate as string | undefined,
      search: req.query.search as string | undefined,
      page,
      limit,
    });
    return void res.json({
      status: 'success',
      data: result.data,
      pagination: { total: result.total, page: result.page, limit: result.limit },
    });
  }
);

router.post(
  '/',
  authorize({ resource: 'invoice', action: 'edit' }),
  validate({ body: createSupplyOrderSchema }),
  async (req: AuthRequest, res: Response) => {
    const companyId = req.companyId || req.tenantId;
    if (!companyId) {
      return void res.status(400).json({ status: 'error', message: 'معرّف الشركة مطلوب' });
    }
    const data = await supplyOrderService.create(companyId, {
      ...req.body,
      branchId: req.body.branchId || req.branchId,
    });
    return void res.status(201).json({ status: 'success', data });
  }
);

router.get(
  '/:id',
  authorize({ resource: 'invoice', action: 'view' }),
  async (req: AuthRequest, res: Response) => {
    const companyId = req.companyId || req.tenantId;
    if (!companyId) {
      return void res.status(400).json({ status: 'error', message: 'معرّف الشركة مطلوب' });
    }
    try {
      const data = await supplyOrderService.getById(companyId, req.params.id);
      return void res.json({ status: 'success', data });
    } catch (error) {
      const status = error instanceof AppError && error.statusCode === 404 ? 404 : 500;
      return void res.status(status).json({
        status: 'error',
        message: error instanceof Error ? error.message : 'تعذر تحميل أمر التوريد',
      });
    }
  }
);

router.put(
  '/:id',
  authorize({ resource: 'invoice', action: 'edit' }),
  validate({ body: createSupplyOrderSchema }),
  async (req: AuthRequest, res: Response) => {
    const companyId = req.companyId || req.tenantId;
    if (!companyId) {
      return void res.status(400).json({ status: 'error', message: 'معرّف الشركة مطلوب' });
    }
    try {
      const data = await supplyOrderService.update(companyId, req.params.id, req.body);
      return void res.json({ status: 'success', data });
    } catch (error) {
      const status = error instanceof AppError ? error.statusCode : 500;
      return void res.status(status).json({
        status: 'error',
        message: error instanceof Error ? error.message : 'تعذر تحديث أمر التوريد',
      });
    }
  }
);

router.post(
  '/:id/close',
  authorize({ resource: 'invoice', action: 'edit' }),
  async (req: AuthRequest, res: Response) => {
    const companyId = req.companyId || req.tenantId;
    if (!companyId) return void res.status(400).json({ status: 'error', message: 'معرّف الشركة مطلوب' });
    const data = await supplyOrderService.setClosed(companyId, req.params.id, true);
    return void res.json({ status: 'success', message: 'تم إغلاق أمر التوريد', data });
  }
);

router.post(
  '/:id/reopen',
  authorize({ resource: 'invoice', action: 'edit' }),
  async (req: AuthRequest, res: Response) => {
    const companyId = req.companyId || req.tenantId;
    if (!companyId) return void res.status(400).json({ status: 'error', message: 'معرّف الشركة مطلوب' });
    const data = await supplyOrderService.setClosed(companyId, req.params.id, false);
    return void res.json({ status: 'success', message: 'تم فتح أمر التوريد', data });
  }
);

router.post(
  '/:id/cancel',
  authorize({ resource: 'invoice', action: 'edit' }),
  async (req: AuthRequest, res: Response) => {
    const companyId = req.companyId || req.tenantId;
    if (!companyId) return void res.status(400).json({ status: 'error', message: 'معرّف الشركة مطلوب' });
    const data = await supplyOrderService.cancel(companyId, req.params.id);
    return void res.json({ status: 'success', message: 'تم إلغاء أمر التوريد', data });
  }
);

router.post(
  '/:id/restore',
  authorize({ resource: 'invoice', action: 'edit' }),
  async (req: AuthRequest, res: Response) => {
    const companyId = req.companyId || req.tenantId;
    if (!companyId) return void res.status(400).json({ status: 'error', message: 'معرّف الشركة مطلوب' });
    const data = await supplyOrderService.restore(companyId, req.params.id);
    return void res.json({ status: 'success', message: 'تم استعادة أمر التوريد', data });
  }
);

export default router;
