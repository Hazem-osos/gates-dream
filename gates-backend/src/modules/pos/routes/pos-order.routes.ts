import { Router, Response } from 'express';
import { authenticate } from '../../../shared/middleware/auth.middleware';
import { authorize } from '../../../shared/middleware/authorize.middleware';
import { tenantAndFiscalContextMiddleware } from '../../../shared/middleware/tenant-fiscal-context.middleware';
import { validate } from '../../../shared/middleware/validate';
import type { AuthRequest } from '../../../shared/auth/types';
import { buildPosPostingContext } from '../services/pos-posting-context';
import { posOrderPostingService } from '../services/pos-order-posting.service';
import { createPosOrderSchema } from '../schemas/pos.schema';

const router = Router();

router.use(authenticate);
router.use(tenantAndFiscalContextMiddleware);

router.post(
  '/',
  authorize({ resource: 'pos', action: 'edit' }),
  validate({ body: createPosOrderSchema }),
  async (req: AuthRequest, res: Response) => {
    const companyId = req.companyId ?? req.tenantId;
    if (!companyId) {
      return void res.status(400).json({ status: 'error', message: 'Company ID required' });
    }
    const { shiftId, ...body } = req.body;
    const data = await posOrderPostingService.createOrder(companyId, shiftId, body);
    return void res.status(201).json({ status: 'success', data });
  }
);

router.post(
  '/:id/post',
  authorize({ resource: 'pos', action: 'post' }),
  async (req: AuthRequest, res: Response) => {
    const ctx = buildPosPostingContext(req);
    const data = await posOrderPostingService.postOrder(ctx, req.params.id);
    return void res.json({ status: 'success', data });
  }
);

router.post(
  '/:id/unpost',
  authorize({ resource: 'pos', action: 'post' }),
  async (req: AuthRequest, res: Response) => {
    const ctx = buildPosPostingContext(req);
    const data = await posOrderPostingService.unpostOrder(ctx, req.params.id);
    return void res.json({ status: 'success', data });
  }
);

export default router;
