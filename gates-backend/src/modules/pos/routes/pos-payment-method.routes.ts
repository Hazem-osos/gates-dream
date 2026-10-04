import { Router, Response } from 'express';
import { z } from 'zod';
import { authenticate } from '../../../shared/middleware/auth.middleware';
import { authorize } from '../../../shared/middleware/authorize.middleware';
import { tenantAndFiscalContextMiddleware } from '../../../shared/middleware/tenant-fiscal-context.middleware';
import { validate } from '../../../shared/middleware/validate';
import type { AuthRequest } from '../../../shared/auth/types';
import { posPaymentMethodService } from '../services/pos-payment-method.service';

const router = Router();
router.use(authenticate);
router.use(tenantAndFiscalContextMiddleware);

const createSchema = z.object({
  code: z.string().min(1).max(20),
  displayName: z.string().min(1).max(80),
  settlementType: z.enum(['CASH', 'BANK', 'CREDIT']),
  safeId: z.string().uuid().nullable().optional(),
  bankAccountId: z.string().uuid().nullable().optional(),
  branchId: z.string().uuid().nullable().optional(),
  terminalId: z.string().uuid().nullable().optional(),
  sortOrder: z.number().int().optional(),
  captureMode: z.enum(['MANUAL', 'TERMINAL']).optional(),
});

const updateSchema = z.object({
  displayName: z.string().min(1).max(80).optional(),
  isActive: z.boolean().optional(),
  safeId: z.string().uuid().nullable().optional(),
  bankAccountId: z.string().uuid().nullable().optional(),
  branchId: z.string().uuid().nullable().optional(),
  terminalId: z.string().uuid().nullable().optional(),
  sortOrder: z.number().int().optional(),
  captureMode: z.enum(['MANUAL', 'TERMINAL']).optional(),
});

router.get('/', authorize({ resource: 'pos', action: 'view' }), async (req: AuthRequest, res: Response) => {
  const companyId = req.companyId ?? req.tenantId;
  if (!companyId) return void res.status(400).json({ status: 'error', message: 'Company ID required' });
  const data = await posPaymentMethodService.list(companyId, {
    terminalId: typeof req.query.terminalId === 'string' ? req.query.terminalId : undefined,
    branchId: typeof req.query.branchId === 'string' ? req.query.branchId : undefined,
    activeOnly: req.query.activeOnly !== 'false',
  });
  return void res.json({ status: 'success', data });
});

router.post(
  '/',
  authorize({ resource: 'pos', action: 'edit' }),
  validate({ body: createSchema }),
  async (req: AuthRequest, res: Response) => {
    const companyId = req.companyId ?? req.tenantId;
    if (!companyId) return void res.status(400).json({ status: 'error', message: 'Company ID required' });
    const data = await posPaymentMethodService.create(companyId, req.body);
    return void res.status(201).json({ status: 'success', data });
  }
);

router.put(
  '/:id',
  authorize({ resource: 'pos', action: 'edit' }),
  validate({ body: updateSchema }),
  async (req: AuthRequest, res: Response) => {
    const companyId = req.companyId ?? req.tenantId;
    if (!companyId) return void res.status(400).json({ status: 'error', message: 'Company ID required' });
    const data = await posPaymentMethodService.update(companyId, req.params.id, req.body);
    return void res.json({ status: 'success', data });
  }
);

export default router;
