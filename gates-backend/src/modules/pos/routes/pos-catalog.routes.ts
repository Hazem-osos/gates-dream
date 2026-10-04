import { Router, Response } from 'express';
import { authenticate } from '../../../shared/middleware/auth.middleware';
import { authorize } from '../../../shared/middleware/authorize.middleware';
import { tenantAndFiscalContextMiddleware } from '../../../shared/middleware/tenant-fiscal-context.middleware';
import type { AuthRequest } from '../../../shared/auth/types';
import { posCatalogService } from '../services/pos-catalog.service';

const router = Router();
router.use(authenticate);
router.use(tenantAndFiscalContextMiddleware);

router.get(
  '/categories',
  authorize({ resource: 'pos', action: 'view' }),
  async (req: AuthRequest, res: Response) => {
    const companyId = req.companyId ?? req.tenantId;
    if (!companyId) return void res.status(400).json({ status: 'error', message: 'معرّف الشركة مطلوب' });
    const data = await posCatalogService.categories(companyId);
    return void res.json({ status: 'success', data });
  }
);

router.get(
  '/customers',
  authorize({ resource: 'pos', action: 'view' }),
  async (req: AuthRequest, res: Response) => {
    const companyId = req.companyId ?? req.tenantId;
    if (!companyId) return void res.status(400).json({ status: 'error', message: 'معرّف الشركة مطلوب' });
    const data = await posCatalogService.customers(companyId, String(req.query.q ?? ''));
    return void res.json({ status: 'success', data });
  }
);

router.get(
  '/barcode',
  authorize({ resource: 'pos', action: 'view' }),
  async (req: AuthRequest, res: Response) => {
    const companyId = req.companyId ?? req.tenantId;
    if (!companyId) return void res.status(400).json({ status: 'error', message: 'معرّف الشركة مطلوب' });
    const data = await posCatalogService.barcode({
      companyId,
      code: String(req.query.code ?? ''),
      warehouseId: req.query.warehouseId ? String(req.query.warehouseId) : undefined,
      customerId: req.query.customerId ? String(req.query.customerId) : undefined,
    });
    if (!data) return void res.status(404).json({ status: 'error', message: 'Unknown barcode' });
    return void res.json({ status: 'success', data });
  }
);

router.get(
  '/',
  authorize({ resource: 'pos', action: 'view' }),
  async (req: AuthRequest, res: Response) => {
    const companyId = req.companyId ?? req.tenantId;
    if (!companyId) return void res.status(400).json({ status: 'error', message: 'معرّف الشركة مطلوب' });
    const data = await posCatalogService.search({
      companyId,
      warehouseId: req.query.warehouseId ? String(req.query.warehouseId) : undefined,
      customerId: req.query.customerId ? String(req.query.customerId) : undefined,
      q: req.query.q ? String(req.query.q) : undefined,
      categoryId: req.query.categoryId ? String(req.query.categoryId) : undefined,
      cursor: req.query.cursor ? String(req.query.cursor) : undefined,
      take: req.query.take ? Number(req.query.take) : undefined,
    });
    return void res.json({ status: 'success', data });
  }
);

export default router;
