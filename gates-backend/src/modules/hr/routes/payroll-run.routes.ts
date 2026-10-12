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
import { payrollWorkflowService } from '../services/payroll/payroll-workflow.service';
import { hcmPayrollCalculateQueue } from '../../../workers/queues/hcm-payroll-calculate.queue';
import { randomUUID } from 'crypto';
import { canViewPayrollAmounts } from '../services/payroll/payroll-permission.util';
import {
  redactSensitiveDeep,
  asPayrollApiData,
  serializePayrollRunRecord,
} from '../services/payroll/payroll-response.serializer';

const router = Router();

router.use(authenticate);
router.use(setTenantContext);

function postingContext(req: AuthRequest) {
  const companyId = req.companyId ?? req.tenantId;
  if (!companyId) throw new AppError(400, 'معرّف الشركة مطلوب');
  return journalEntryService.buildPostingContext(
    companyId,
    req.branchId,
    req.user?.sub ?? 'system',
    req.fiscalYearId,
    isAdminRequest(req)
  );
}

router.post(
  '/calculate-async',
  authorize({ resource: 'payroll', action: 'calculate' }),
  async (req: AuthRequest, res: Response) => {
    const companyId = req.companyId ?? req.tenantId;
    if (!companyId) {
      return void res.status(400).json({ status: 'error', message: 'معرّف الشركة مطلوب' });
    }
    const { periodMonth, periodYear, idempotencyKey } = req.body as {
      periodMonth: number;
      periodYear: number;
      idempotencyKey?: string;
    };
    const key = idempotencyKey ?? randomUUID();
    const job = await hcmPayrollCalculateQueue.add(
      'calculate',
      {
        companyId,
        periodYear: Number(periodYear),
        periodMonth: Number(periodMonth),
        requestedBy: req.user?.sub,
        idempotencyKey: key,
      },
      { jobId: `${companyId}:${periodYear}:${periodMonth}:${key}` }
    );
    return void res.status(202).json({
      status: 'success',
      data: { jobId: job.id, idempotencyKey: key, queue: 'hcm-payroll-calculate' },
    });
  }
);

router.get(
  '/calculate-async/:jobId',
  authorize({ resource: 'payroll', action: 'view' }),
  async (req: AuthRequest, res: Response) => {
    const companyId = req.companyId ?? req.tenantId;
    const job = await hcmPayrollCalculateQueue.getJob(req.params.jobId);
    if (!job) {
      return void res.status(404).json({ status: 'error', message: 'Job not found' });
    }
    const state = await job.getState();
    const progress = job.progress;
    const includeAmounts = companyId ? await canViewPayrollAmounts(req, companyId) : false;
    return void res.json({
      status: 'success',
      data: {
        jobId: job.id,
        state,
        progress,
        result: redactSensitiveDeep(job.returnvalue, includeAmounts),
        failedReason: job.failedReason,
      },
    });
  }
);

router.post(
  '/',
  authorize({ resource: 'payroll', action: 'calculate' }),
  async (req: AuthRequest, res: Response) => {
    const companyId = req.companyId ?? req.tenantId;
    if (!companyId) {
      return void res.status(400).json({ status: 'error', message: 'معرّف الشركة مطلوب' });
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
      const includeAmounts = await canViewPayrollAmounts(req, companyId);
      return void res.status(201).json({
        status: 'success',
        data: serializePayrollRunRecord(data as Record<string, unknown>, includeAmounts),
      });
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
      return void res.status(400).json({ status: 'error', message: 'معرّف الشركة مطلوب' });
    }
    try {
      const data = await payrollEngineService.getPayrollRun(companyId, req.params.id);
      const includeAmounts = await canViewPayrollAmounts(req, companyId);
      return void res.json({
        status: 'success',
        data: serializePayrollRunRecord(data as Record<string, unknown>, includeAmounts),
      });
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
  '/:id/approve',
  authorize({ resource: 'payroll', action: 'approve' }),
  async (req: AuthRequest, res: Response) => {
    const companyId = req.companyId ?? req.tenantId;
    if (!companyId) {
      return void res.status(400).json({ status: 'error', message: 'معرّف الشركة مطلوب' });
    }
    try {
      const data = await payrollWorkflowService.approveRun(companyId, req.params.id, req.user?.sub ?? 'system');
      const includeAmounts = await canViewPayrollAmounts(req, companyId);
      return void res.json({
        status: 'success',
        data: asPayrollApiData(data, includeAmounts),
      });
    } catch (e) {
      const status = e instanceof AppError ? e.statusCode : 500;
      return void res.status(status).json({
        status: 'error',
        message: e instanceof Error ? e.message : 'Approve failed',
      });
    }
  }
);

router.post(
  '/:id/post-accrual',
  authorize({ resource: 'payroll', action: 'post' }),
  async (req: AuthRequest, res: Response) => {
    try {
      const ctx = postingContext(req);
      if (!ctx.fiscalYearId) {
        return void res.status(400).json({ status: 'error', message: 'X-Fiscal-Year-Id required' });
      }
      const data = await payrollPostingService.postAccrual(ctx, req.params.id);
      const includeAmounts = await canViewPayrollAmounts(req, ctx.companyId);
      return void res.json({ status: 'success', data: asPayrollApiData(data, includeAmounts) });
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
  authorize({ resource: 'payroll', action: 'post' }),
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
  authorize({ resource: 'payroll', action: 'pay' }),
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
      const includeAmounts = await canViewPayrollAmounts(req, ctx.companyId);
      return void res.json({ status: 'success', data: asPayrollApiData(data, includeAmounts) });
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
  authorize({ resource: 'payroll', action: 'pay' }),
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
