import { Router, Response } from 'express';
import { authenticate } from '../../../shared/middleware/auth.middleware';
import { authorize } from '../../../shared/middleware/authorize.middleware';
import { setTenantContext } from '../../../shared/middleware/tenant.middleware';
import { AppError } from '../../../shared/middleware/error-handler';
import type { AuthRequest } from '../../../shared/auth/types';
import { payrollAdvanceService } from '../services/payroll-advance.service';

const router = Router();

router.use(authenticate);
router.use(setTenantContext);

router.post(
  '/',
  authorize({ resource: 'payroll', action: 'edit' }),
  async (req: AuthRequest, res: Response) => {
    const companyId = req.companyId ?? req.tenantId;
    if (!companyId) {
      return void res.status(400).json({ status: 'error', message: 'Company ID required' });
    }
    try {
      const data = await payrollAdvanceService.create(companyId, {
        employeeId: req.body.employeeId,
        date: req.body.date ? new Date(req.body.date) : new Date(),
        amount: Number(req.body.amount),
        installmentAmount:
          req.body.installmentAmount != null
            ? Number(req.body.installmentAmount)
            : undefined,
        notes: req.body.notes,
      });
      return void res.status(201).json({ status: 'success', data });
    } catch (e) {
      const status = e instanceof AppError ? e.statusCode : 500;
      return void res.status(status).json({
        status: 'error',
        message: e instanceof Error ? e.message : 'Create advance failed',
      });
    }
  }
);

router.get(
  '/',
  authorize({ resource: 'payroll', action: 'view' }),
  async (req: AuthRequest, res: Response) => {
    const companyId = req.companyId ?? req.tenantId;
    if (!companyId) {
      return void res.status(400).json({ status: 'error', message: 'Company ID required' });
    }
    try {
      const data = await payrollAdvanceService.listOpen(
        companyId,
        req.query.employeeId as string | undefined
      );
      return void res.json({ status: 'success', data });
    } catch (e) {
      const status = e instanceof AppError ? e.statusCode : 500;
      return void res.status(status).json({
        status: 'error',
        message: e instanceof Error ? e.message : 'List advances failed',
      });
    }
  }
);

export default router;
