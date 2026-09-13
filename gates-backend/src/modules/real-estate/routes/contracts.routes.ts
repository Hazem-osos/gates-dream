import { Router, Response } from 'express';
import { authenticate } from '../../../shared/middleware/auth.middleware';
import { authorize } from '../../../shared/middleware/authorize.middleware';
import { setTenantContext } from '../../../shared/middleware/tenant.middleware';
import { AppError } from '../../../shared/middleware/error-handler';
import type { AuthRequest } from '../../../shared/auth/types';
import { isAdminRequest } from '../../../shared/auth/roles.util';
import { journalEntryService } from '../../accounting/services/journal-entry.service';
import { unitContractService } from '../services/unit-contract.service';

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
      const data = await unitContractService.createWithSchedule(companyId, {
        ...(body as Parameters<typeof unitContractService.createWithSchedule>[1]),
        contractDate: new Date(String(body.contractDate)),
        deliveryDate: body.deliveryDate ? new Date(String(body.deliveryDate)) : undefined,
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
  '/',
  authorize({ resource: 'invoice', action: 'view' }),
  async (req: AuthRequest, res: Response) => {
    const companyId = req.companyId ?? req.tenantId;
    if (!companyId) {
      return void res.status(400).json({ status: 'error', message: 'Company ID required' });
    }
    try {
      const data = await unitContractService.list(companyId, {
        status: req.query.status as string | undefined,
        customerId: req.query.customerId as string | undefined,
        limit: req.query.limit ? Number(req.query.limit) : undefined,
      });
      return void res.json({ status: 'success', data });
    } catch (e) {
      const status = e instanceof AppError ? e.statusCode : 500;
      return void res.status(status).json({
        status: 'error',
        message: e instanceof Error ? e.message : 'List contracts failed',
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
      const data = await unitContractService.getById(companyId, req.params.id);
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
  '/:id/post-contract',
  authorize({ resource: 'invoice', action: 'edit' }),
  async (req: AuthRequest, res: Response) => {
    const companyId = req.companyId ?? req.tenantId;
    if (!companyId || !req.branchId || !req.fiscalYearId) {
      return void res.status(400).json({ status: 'error', message: 'Tenant context required' });
    }
    try {
      const ctx = postingContext(req);
      const data = await unitContractService.postContractExecution(ctx, req.params.id);
      return void res.json({ status: 'success', data });
    } catch (e) {
      const status = e instanceof AppError ? e.statusCode : 500;
      return void res.status(status).json({
        status: 'error',
        message: e instanceof Error ? e.message : 'Post contract failed',
      });
    }
  }
);

router.post(
  '/:id/handover',
  authorize({ resource: 'invoice', action: 'edit' }),
  async (req: AuthRequest, res: Response) => {
    const companyId = req.companyId ?? req.tenantId;
    if (!companyId) {
      return void res.status(400).json({ status: 'error', message: 'Company ID required' });
    }
    try {
      const ctx = postingContext(req);
      const handoverDate = req.body?.handoverDate
        ? new Date(String(req.body.handoverDate))
        : undefined;
      const data = await unitContractService.handoverUnit(ctx, req.params.id, handoverDate);
      return void res.json({ status: 'success', data });
    } catch (e) {
      const status = e instanceof AppError ? e.statusCode : 500;
      return void res.status(status).json({
        status: 'error',
        message: e instanceof Error ? e.message : 'Handover failed',
      });
    }
  }
);

router.post(
  '/:id/unpost-contract',
  authorize({ resource: 'invoice', action: 'edit' }),
  async (req: AuthRequest, res: Response) => {
    try {
      const ctx = postingContext(req);
      const data = await unitContractService.unpostContractExecution(ctx, req.params.id);
      return void res.json({ status: 'success', data });
    } catch (e) {
      const status = e instanceof AppError ? e.statusCode : 500;
      return void res.status(status).json({
        status: 'error',
        message: e instanceof Error ? e.message : 'Unpost contract failed',
      });
    }
  }
);

router.post(
  '/:id/unpost-handover',
  authorize({ resource: 'invoice', action: 'edit' }),
  async (req: AuthRequest, res: Response) => {
    try {
      const ctx = postingContext(req);
      const data = await unitContractService.unpostHandover(ctx, req.params.id);
      return void res.json({ status: 'success', data });
    } catch (e) {
      const status = e instanceof AppError ? e.statusCode : 500;
      return void res.status(status).json({
        status: 'error',
        message: e instanceof Error ? e.message : 'Unpost handover failed',
      });
    }
  }
);

router.post(
  '/:id/terminate',
  authorize({ resource: 'invoice', action: 'edit' }),
  async (req: AuthRequest, res: Response) => {
    try {
      const ctx = postingContext(req);
      const reason = req.body?.reason ? String(req.body.reason) : undefined;
      const data = await unitContractService.terminateContract(ctx, req.params.id, reason);
      return void res.json({ status: 'success', data });
    } catch (e) {
      const status = e instanceof AppError ? e.statusCode : 500;
      return void res.status(status).json({
        status: 'error',
        message: e instanceof Error ? e.message : 'Terminate contract failed',
      });
    }
  }
);

router.post(
  '/:id/regenerate-installments',
  authorize({ resource: 'invoice', action: 'edit' }),
  async (req: AuthRequest, res: Response) => {
    const companyId = req.companyId ?? req.tenantId;
    if (!companyId) {
      return void res.status(400).json({ status: 'error', message: 'Company ID required' });
    }
    try {
      const body = req.body as Record<string, unknown>;
      const data = await unitContractService.regenerateInstallments(companyId, req.params.id, {
        fromDate: new Date(String(body.fromDate)),
        frequency: body.frequency as Parameters<
          typeof unitContractService.regenerateInstallments
        >[2]['frequency'],
        installmentCount: Number(body.installmentCount),
      });
      return void res.json({ status: 'success', data });
    } catch (e) {
      const status = e instanceof AppError ? e.statusCode : 500;
      return void res.status(status).json({
        status: 'error',
        message: e instanceof Error ? e.message : 'Regenerate installments failed',
      });
    }
  }
);

export default router;
