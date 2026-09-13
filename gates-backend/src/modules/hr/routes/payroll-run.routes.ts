import { Router, Response } from 'express';
import { authenticate } from '../../../shared/middleware/auth.middleware';
import { authorize } from '../../../shared/middleware/authorize.middleware';
import { setTenantContext } from '../../../shared/middleware/tenant.middleware';
import { AppError } from '../../../shared/middleware/error-handler';
import type { AuthRequest } from '../../../shared/auth/types';
import { isAdminRequest } from '../../../shared/auth/roles.util';
import { journalEntryService } from '../../accounting/services/journal-entry.service';
import { payrollEngineService } from '../services/payroll-engine.service';
import { payrollPostingService } from '../services/payroll-posting.service';

const router = Router();

router.use(authenticate);
router.use(setTenantContext);

function postingContext(req: AuthRequest) {
  const companyId = req.companyId ?? req.tenantId;
  if (!companyId) throw new AppError(400, 'Company ID required');
  return journalEntryService.buildPostingContext(
    companyId,
    req.branchId,
    req.user?.sub ?? 'system',
    req.fiscalYearId,
    isAdminRequest(req)
  );
}

router.post(
  '/',
  authorize({ resource: 'payroll', action: 'edit' }),
  async (req: AuthRequest, res: Response) => {
    const companyId = req.companyId ?? req.tenantId;
    if (!companyId) {
      return void res.status(400).json({ status: 'error', message: 'Company ID required' });
    }
    try {
      const { periodMonth, periodYear, fiscalYearId, branchId, employeeInputs } = req.body;
      const data = await payrollEngineService.createPayrollRun(companyId, {
        periodMonth: Number(periodMonth),
        periodYear: Number(periodYear),
        fiscalYearId: fiscalYearId ?? req.fiscalYearId,
        branchId: branchId ?? req.branchId,
        employeeInputs,
      });
      return void res.status(201).json({ status: 'success', data });
    } catch (e) {
      const status = e instanceof AppError ? e.statusCode : 500;
      return void res.status(status).json({
        status: 'error',
        message: e instanceof Error ? e.message : 'Payroll run failed',
      });
    }
  }
);

router.get(
  '/:id',
  authorize({ resource: 'payroll', action: 'view' }),
  async (req: AuthRequest, res: Response) => {
    const companyId = req.companyId ?? req.tenantId;
    if (!companyId) {
      return void res.status(400).json({ status: 'error', message: 'Company ID required' });
    }
    try {
      const data = await payrollEngineService.getPayrollRun(companyId, req.params.id);
      return void res.json({ status: 'success', data });
    } catch (e) {
      const status = e instanceof AppError ? e.statusCode : 500;
      return void res.status(status).json({
        status: 'error',
        message: e instanceof Error ? e.message : 'Get payroll run failed',
      });
    }
  }
);

router.post(
  '/:id/post-accrual',
  authorize({ resource: 'payroll', action: 'edit' }),
  async (req: AuthRequest, res: Response) => {
    try {
      const ctx = postingContext(req);
      if (!ctx.fiscalYearId) {
        return void res.status(400).json({ status: 'error', message: 'X-Fiscal-Year-Id required' });
      }
      const data = await payrollPostingService.postAccrual(ctx, req.params.id);
      return void res.json({ status: 'success', data });
    } catch (e) {
      const status = e instanceof AppError ? e.statusCode : 500;
      return void res.status(status).json({
        status: 'error',
        message: e instanceof Error ? e.message : 'Accrual posting failed',
      });
    }
  }
);

router.post(
  '/:id/unpost-accrual',
  authorize({ resource: 'payroll', action: 'edit' }),
  async (req: AuthRequest, res: Response) => {
    try {
      const ctx = postingContext(req);
      if (!ctx.fiscalYearId) {
        return void res.status(400).json({ status: 'error', message: 'X-Fiscal-Year-Id required' });
      }
      const data = await payrollPostingService.unpostAccrual(ctx, req.params.id);
      return void res.json({ status: 'success', data });
    } catch (e) {
      const status = e instanceof AppError ? e.statusCode : 500;
      return void res.status(status).json({
        status: 'error',
        message: e instanceof Error ? e.message : 'Accrual unposting failed',
      });
    }
  }
);

router.post(
  '/:id/disburse',
  authorize({ resource: 'payroll', action: 'edit' }),
  async (req: AuthRequest, res: Response) => {
    try {
      const ctx = postingContext(req);
      if (!ctx.fiscalYearId) {
        return void res.status(400).json({ status: 'error', message: 'X-Fiscal-Year-Id required' });
      }
      const data = await payrollPostingService.disbursePayroll(ctx, req.params.id, {
        safeId: req.body?.safeId,
        bankAccountId: req.body?.bankAccountId,
      });
      return void res.json({ status: 'success', data });
    } catch (e) {
      const status = e instanceof AppError ? e.statusCode : 500;
      return void res.status(status).json({
        status: 'error',
        message: e instanceof Error ? e.message : 'Disbursement failed',
      });
    }
  }
);

router.post(
  '/:id/unpost-disbursement',
  authorize({ resource: 'payroll', action: 'edit' }),
  async (req: AuthRequest, res: Response) => {
    try {
      const ctx = postingContext(req);
      if (!ctx.fiscalYearId) {
        return void res.status(400).json({ status: 'error', message: 'X-Fiscal-Year-Id required' });
      }
      const data = await payrollPostingService.unpostDisbursement(ctx, req.params.id);
      return void res.json({ status: 'success', data });
    } catch (e) {
      const status = e instanceof AppError ? e.statusCode : 500;
      return void res.status(status).json({
        status: 'error',
        message: e instanceof Error ? e.message : 'Disbursement unposting failed',
      });
    }
  }
);

export default router;
