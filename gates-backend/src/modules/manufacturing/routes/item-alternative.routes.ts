import { Router, Response } from 'express';
import { authenticate } from '../../../shared/middleware/auth.middleware';
import { authorize } from '../../../shared/middleware/authorize.middleware';
import { setTenantContext } from '../../../shared/middleware/tenant.middleware';
import { validate } from '../../../shared/middleware/validate';
import { AppError } from '../../../shared/middleware/error-handler';
import type { AuthRequest } from '../../../shared/auth/types';
import { itemAlternativeService } from '../services/item-alternative.service';
import {
  itemAlternativesBatchQuerySchema,
  saveItemAlternativesSchema,
} from '../schemas/item-alternative.schema';

const router = Router();

router.use(authenticate);
router.use(setTenantContext);

router.get(
  '/counts',
  authorize({ resource: 'invoice', action: 'view' }),
  validate({ query: itemAlternativesBatchQuerySchema }),
  async (req: AuthRequest, res: Response) => {
    const companyId = req.companyId ?? req.tenantId;
    if (!companyId) {
      return void res.status(400).json({ status: 'error', message: 'معرّف الشركة مطلوب' });
    }
    const itemIds = String(req.query.itemIds)
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    const data = await itemAlternativeService.countsForItems(companyId, itemIds);
    return void res.json({ status: 'success', data });
  }
);

router.get(
  '/by-item/:itemId',
  authorize({ resource: 'invoice', action: 'view' }),
  async (req: AuthRequest, res: Response) => {
    const companyId = req.companyId ?? req.tenantId;
    if (!companyId) {
      return void res.status(400).json({ status: 'error', message: 'معرّف الشركة مطلوب' });
    }
    try {
      const data = await itemAlternativeService.listForItem(companyId, req.params.itemId);
      return void res.json({ status: 'success', data });
    } catch (e) {
      const status = e instanceof AppError ? e.statusCode : 500;
      return void res.status(status).json({
        status: 'error',
        message: e instanceof Error ? e.message : 'Failed to load item alternatives',
      });
    }
  }
);

router.put(
  '/by-item/:itemId',
  authorize({ resource: 'invoice', action: 'edit' }),
  validate({ body: saveItemAlternativesSchema }),
  async (req: AuthRequest, res: Response) => {
    const companyId = req.companyId ?? req.tenantId;
    if (!companyId) {
      return void res.status(400).json({ status: 'error', message: 'معرّف الشركة مطلوب' });
    }
    try {
      const data = await itemAlternativeService.saveForItem(
        companyId,
        req.params.itemId,
        req.body.lines
      );
      return void res.json({ status: 'success', data });
    } catch (e) {
      const status = e instanceof AppError ? e.statusCode : 500;
      return void res.status(status).json({
        status: 'error',
        message: e instanceof Error ? e.message : 'Failed to save item alternatives',
      });
    }
  }
);

export default router;
