import { Router, Response } from 'express';
import { authenticate } from '../../../shared/middleware/auth.middleware';
import { authorize } from '../../../shared/middleware/authorize.middleware';
import { tenantAndFiscalContextMiddleware } from '../../../shared/middleware/tenant-fiscal-context.middleware';
import { validate } from '../../../shared/middleware/validate';
import type { AuthRequest } from '../../../shared/auth/types';
import { posTerminalService } from '../services/pos-terminal.service';
import { createPosTerminalSchema } from '../schemas/pos.schema';

const router = Router();

router.use(authenticate);
router.use(tenantAndFiscalContextMiddleware);

router.get(
  '/',
  authorize({ resource: 'pos', action: 'view' }),
  async (req: AuthRequest, res: Response) => {
    const companyId = req.companyId ?? req.tenantId;
    if (!companyId) {
      return void res.status(400).json({ status: 'error', message: 'Company ID required' });
    }
    const data = await posTerminalService.list(companyId);
    return void res.json({ status: 'success', data });
  }
);

router.post(
  '/',
  authorize({ resource: 'pos', action: 'edit' }),
  validate({ body: createPosTerminalSchema }),
  async (req: AuthRequest, res: Response) => {
    const companyId = req.companyId ?? req.tenantId;
    if (!companyId) {
      return void res.status(400).json({ status: 'error', message: 'Company ID required' });
    }
    const data = await posTerminalService.create(companyId, req.body);
    return void res.status(201).json({ status: 'success', data });
  }
);

router.get(
  '/items/lookup',
  authorize({ resource: 'pos', action: 'view' }),
  async (req: AuthRequest, res: Response) => {
    const companyId = req.companyId ?? req.tenantId;
    const barcode = req.query.barcode as string;
    if (!companyId || !barcode) {
      return void res.status(400).json({ status: 'error', message: 'barcode required' });
    }
    const warehouseId = typeof req.query.warehouseId === 'string' ? req.query.warehouseId : undefined;
    const data = await posTerminalService.lookupItemByBarcode(companyId, barcode, warehouseId);
    return void res.json({ status: 'success', data });
  }
);

export default router;
