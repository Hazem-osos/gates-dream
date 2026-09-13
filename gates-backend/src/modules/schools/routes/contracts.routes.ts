import { Router, Response } from 'express';
import { authenticate } from '../../../shared/middleware/auth.middleware';
import { authorize } from '../../../shared/middleware/authorize.middleware';
import { setTenantContext } from '../../../shared/middleware/tenant.middleware';
import { AppError } from '../../../shared/middleware/error-handler';
import type { AuthRequest } from '../../../shared/auth/types';
import { isAdminRequest } from '../../../shared/auth/roles.util';
import { journalEntryService } from '../../accounting/services/journal-entry.service';
import { tuitionBillingService } from '../services/tuition-billing.service';

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
  authorize({ resource: 'invoice', action: 'edit' }),
  async (req: AuthRequest, res: Response) => {
    const companyId = req.companyId ?? req.tenantId;
    if (!companyId) {
      return void res.status(400).json({ status: 'error', message: 'Company ID required' });
    }
    try {
      const body = req.body as Record<string, unknown>;
      const termDueDates = Array.isArray(body.termDueDates)
        ? (body.termDueDates as Array<{ termName: string; dueDate: string }>).map((t) => ({
            termName: t.termName,
            dueDate: new Date(t.dueDate),
          }))
        : undefined;
      const data = await tuitionBillingService.createFeeContract(companyId, {
        ...(body as Omit<Parameters<typeof tuitionBillingService.createFeeContract>[1], 'termDueDates'>),
        termDueDates,
      });
      return void res.status(201).json({ status: 'success', data });
    } catch (e) {
      const status = e instanceof AppError ? e.statusCode : 500;
      return void res.status(status).json({
        status: 'error',
        message: e instanceof Error ? e.message : 'Create contract failed',
      });
    }
  }
);

router.get(
  '/:id',
  authorize({ resource: 'invoice', action: 'view' }),
  async (req: AuthRequest, res: Response) => {
    const companyId = req.companyId ?? req.tenantId;
    if (!companyId) {
      return void res.status(400).json({ status: 'error', message: 'Company ID required' });
    }
    try {
      const data = await tuitionBillingService.getContract(companyId, req.params.id);
      return void res.json({ status: 'success', data });
    } catch (e) {
      const status = e instanceof AppError ? e.statusCode : 500;
      return void res.status(status).json({
        status: 'error',
        message: e instanceof Error ? e.message : 'Get contract failed',
      });
    }
  }
);

router.post(
  '/:id/post-accrual',
  authorize({ resource: 'invoice', action: 'edit' }),
  async (req: AuthRequest, res: Response) => {
    const companyId = req.companyId ?? req.tenantId;
    if (!companyId) {
      return void res.status(400).json({ status: 'error', message: 'Company ID required' });
    }
    try {
      const ctx = postingContext(req);
      const data = await tuitionBillingService.postFeeAccrual(ctx, req.params.id);
      return void res.json({ status: 'success', data });
    } catch (e) {
      const status = e instanceof AppError ? e.statusCode : 500;
      return void res.status(status).json({
        status: 'error',
        message: e instanceof Error ? e.message : 'Post accrual failed',
      });
    }
  }
);

router.post(
  '/:id/recognize-revenue',
  authorize({ resource: 'invoice', action: 'edit' }),
  async (req: AuthRequest, res: Response) => {
    const companyId = req.companyId ?? req.tenantId;
    if (!companyId) {
      return void res.status(400).json({ status: 'error', message: 'Company ID required' });
    }
    try {
      const ctx = postingContext(req);
      const body = req.body as { amount?: number; recognitionDate?: string };
      const data = await tuitionBillingService.recognizeTermRevenue(ctx, req.params.id, {
        amount: body.amount,
        recognitionDate: body.recognitionDate
          ? new Date(body.recognitionDate)
          : undefined,
      });
      return void res.json({ status: 'success', data });
    } catch (e) {
      const status = e instanceof AppError ? e.statusCode : 500;
      return void res.status(status).json({
        status: 'error',
        message: e instanceof Error ? e.message : 'Revenue recognition failed',
      });
    }
  }
);

router.post(
  '/:id/unpost-accrual',
  authorize({ resource: 'invoice', action: 'edit' }),
  async (req: AuthRequest, res: Response) => {
    try {
      const ctx = postingContext(req);
      const data = await tuitionBillingService.unpostFeeAccrual(ctx, req.params.id);
      return void res.json({ status: 'success', data });
    } catch (e) {
      const status = e instanceof AppError ? e.statusCode : 500;
      return void res.status(status).json({
        status: 'error',
        message: e instanceof Error ? e.message : 'Unpost accrual failed',
      });
    }
  }
);

router.post(
  '/:id/unpost-revenue',
  authorize({ resource: 'invoice', action: 'edit' }),
  async (req: AuthRequest, res: Response) => {
    try {
      const ctx = postingContext(req);
      const data = await tuitionBillingService.unpostTermRevenueRecognition(ctx, req.params.id);
      return void res.json({ status: 'success', data });
    } catch (e) {
      const status = e instanceof AppError ? e.statusCode : 500;
      return void res.status(status).json({
        status: 'error',
        message: e instanceof Error ? e.message : 'Unpost revenue recognition failed',
      });
    }
  }
);

export default router;
