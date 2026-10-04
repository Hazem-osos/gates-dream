import { Router, Response } from 'express';
import { z } from 'zod';
import { authenticate } from '../../../shared/middleware/auth.middleware';
import { authorize } from '../../../shared/middleware/authorize.middleware';
import { tenantAndFiscalContextMiddleware } from '../../../shared/middleware/tenant-fiscal-context.middleware';
import { validate } from '../../../shared/middleware/validate';
import type { AuthRequest } from '../../../shared/auth/types';
import { posRetailReport } from '../services/pos-report.service';

const router = Router();
router.use(authenticate);
router.use(tenantAndFiscalContextMiddleware);

const querySchema = z.object({
  from: z.coerce.date(),
  to: z.coerce.date(),
  branchId: z.string().uuid().optional(),
  terminalId: z.string().uuid().optional(),
  shiftId: z.string().uuid().optional(),
});

router.get(
  '/',
  authorize({ resource: 'pos', action: 'view' }),
  validate({ query: querySchema }),
  async (req: AuthRequest, res: Response) => {
    const companyId = req.companyId ?? req.tenantId;
    if (!companyId) return void res.status(400).json({ status: 'error', message: 'Company ID required' });
    const data = await posRetailReport(companyId, {
      from: req.query.from as unknown as Date,
      to: req.query.to as unknown as Date,
      branchId: req.query.branchId as string | undefined,
      terminalId: req.query.terminalId as string | undefined,
      shiftId: req.query.shiftId as string | undefined,
    });
    return void res.json({ status: 'success', data });
  }
);

export default router;
