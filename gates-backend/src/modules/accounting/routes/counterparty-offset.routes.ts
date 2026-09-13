import { Router, Response } from 'express';
import { authenticate } from '../../../shared/middleware/auth.middleware';
import { authorize } from '../../../shared/middleware/authorize.middleware';
import { setTenantContext } from '../../../shared/middleware/tenant.middleware';
import { AppError } from '../../../shared/middleware/error-handler';
import type { AuthRequest } from '../../../shared/auth/types';
import { counterpartyOffsetService } from '../services/counterparty-offset.service';
import { z } from 'zod';

const router = Router();
router.use(authenticate);
router.use(setTenantContext);

const executeSchema = z.object({
  customerId: z.string().uuid(),
  amount: z.number().positive(),
  date: z.coerce.date().optional(),
  branchId: z.string().uuid().optional().nullable(),
  fiscalYearId: z.string().uuid(),
});

const reverseSchema = z.object({
  branchId: z.string().uuid().optional().nullable(),
  fiscalYearId: z.string().uuid(),
});

router.get(
  '/counterparty-offset/:customerId/summary',
  authorize({ resource: 'customer', action: 'view' }),
  async (req: AuthRequest, res: Response) => {
    try {
      const companyId = req.companyId ?? req.tenantId;
      if (!companyId) throw new AppError(400, 'Company ID is required');
      const data = await counterpartyOffsetService.getSummary(companyId, req.params.customerId);
      return void res.json({ status: 'success', data });
    } catch (e) {
      const status = e instanceof AppError ? e.statusCode : 500;
      return void res.status(status).json({
        status: 'error',
        message: e instanceof Error ? e.message : 'Summary failed',
      });
    }
  }
);

router.post(
  '/counterparty-offset',
  authorize({ resource: 'customer', action: 'edit' }),
  async (req: AuthRequest, res: Response) => {
    try {
      const companyId = req.companyId ?? req.tenantId;
      const userId = req.user?.sub;
      if (!companyId || !userId) throw new AppError(400, 'Company and user required');

      const body = executeSchema.parse(req.body);
      const data = await counterpartyOffsetService.execute({
        companyId,
        customerId: body.customerId,
        amount: body.amount,
        date: body.date ?? new Date(),
        userId,
        branchId: body.branchId,
        fiscalYearId: body.fiscalYearId,
      });
      return void res.status(201).json({ status: 'success', data });
    } catch (e) {
      const status = e instanceof AppError ? e.statusCode : 400;
      return void res.status(status).json({
        status: 'error',
        message: e instanceof Error ? e.message : 'Offset failed',
      });
    }
  }
);

router.post(
  '/counterparty-offset/:id/reverse',
  authorize({ resource: 'customer', action: 'edit' }),
  async (req: AuthRequest, res: Response) => {
    try {
      const companyId = req.companyId ?? req.tenantId;
      const userId = req.user?.sub;
      if (!companyId || !userId) throw new AppError(400, 'Company and user required');

      const body = reverseSchema.parse(req.body);
      const data = await counterpartyOffsetService.reverse({
        companyId,
        offsetId: req.params.id,
        userId,
        branchId: body.branchId,
        fiscalYearId: body.fiscalYearId,
      });
      return void res.json({ status: 'success', data });
    } catch (e) {
      const status = e instanceof AppError ? e.statusCode : 400;
      return void res.status(status).json({
        status: 'error',
        message: e instanceof Error ? e.message : 'Offset reversal failed',
      });
    }
  }
);

export default router;
