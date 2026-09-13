import { Router, Response } from 'express';
import { authenticate } from '../../../shared/middleware/auth.middleware';
import { authorize } from '../../../shared/middleware/authorize.middleware';
import { setTenantContext } from '../../../shared/middleware/tenant.middleware';
import { AppError } from '../../../shared/middleware/error-handler';
import type { AuthRequest } from '../../../shared/auth/types';
import { isAdminRequest } from '../../../shared/auth/roles.util';
import { journalEntryService } from '../../accounting/services/journal-entry.service';
import { contractExtractService } from '../services/contract-extract.service';

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

router.get(
  '/context',
  authorize({ resource: 'invoice', action: 'view' }),
  async (req: AuthRequest, res: Response) => {
    const companyId = req.companyId ?? req.tenantId;
    if (!companyId) {
      return void res.status(400).json({ status: 'error', message: 'Company ID required' });
    }
    const projectId = req.query.projectId as string;
    const extractType = req.query.extractType as 'CLIENT' | 'SUBCONTRACTOR';
    const partyId = req.query.partyId as string;
    if (!projectId || !extractType || !partyId) {
      return void res.status(400).json({
        status: 'error',
        message: 'projectId, extractType, and partyId are required',
      });
    }
    try {
      const data = await contractExtractService.getProjectContext(
        companyId,
        projectId,
        extractType,
        partyId
      );
      return void res.json({ status: 'success', data });
    } catch (e) {
      const status = e instanceof AppError ? e.statusCode : 500;
      return void res.status(status).json({
        status: 'error',
        message: e instanceof Error ? e.message : 'Load context failed',
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
      const data = await contractExtractService.list(companyId, {
        projectId: req.query.projectId as string | undefined,
        extractType: req.query.extractType as string | undefined,
        status: req.query.status as string | undefined,
      });
      return void res.json({ status: 'success', data });
    } catch (e) {
      const status = e instanceof AppError ? e.statusCode : 500;
      return void res.status(status).json({
        status: 'error',
        message: e instanceof Error ? e.message : 'List extracts failed',
      });
    }
  }
);

router.post(
  '/',
  authorize({ resource: 'invoice', action: 'edit' }),
  async (req: AuthRequest, res: Response) => {
    const companyId = req.companyId ?? req.tenantId;
    if (!companyId) {
      return void res.status(400).json({ status: 'error', message: 'Company ID required' });
    }
    try {
      const data = await contractExtractService.createDraft(companyId, {
        ...req.body,
        extractDate: req.body.extractDate ? new Date(req.body.extractDate) : undefined,
        periodStart: req.body.periodStart ? new Date(req.body.periodStart) : undefined,
        periodEnd: req.body.periodEnd ? new Date(req.body.periodEnd) : undefined,
      });
      return void res.status(201).json({ status: 'success', data });
    } catch (e) {
      const status = e instanceof AppError ? e.statusCode : 500;
      return void res.status(status).json({
        status: 'error',
        message: e instanceof Error ? e.message : 'Create extract failed',
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
      const data = await contractExtractService.getById(companyId, req.params.id);
      return void res.json({ status: 'success', data });
    } catch (e) {
      const status = e instanceof AppError ? e.statusCode : 500;
      return void res.status(status).json({
        status: 'error',
        message: e instanceof Error ? e.message : 'Get extract failed',
      });
    }
  }
);

router.put(
  '/:id',
  authorize({ resource: 'invoice', action: 'edit' }),
  async (req: AuthRequest, res: Response) => {
    const companyId = req.companyId ?? req.tenantId;
    if (!companyId) {
      return void res.status(400).json({ status: 'error', message: 'Company ID required' });
    }
    try {
      const data = await contractExtractService.updateDraft(companyId, req.params.id, {
        ...req.body,
        extractDate: req.body.extractDate ? new Date(req.body.extractDate) : undefined,
        periodStart: req.body.periodStart ? new Date(req.body.periodStart) : undefined,
        periodEnd: req.body.periodEnd ? new Date(req.body.periodEnd) : undefined,
      });
      return void res.json({ status: 'success', data });
    } catch (e) {
      const status = e instanceof AppError ? e.statusCode : 500;
      return void res.status(status).json({
        status: 'error',
        message: e instanceof Error ? e.message : 'Update extract failed',
      });
    }
  }
);

router.post(
  '/:id/approve',
  authorize({ resource: 'invoice', action: 'edit' }),
  async (req: AuthRequest, res: Response) => {
    const companyId = req.companyId ?? req.tenantId;
    if (!companyId) {
      return void res.status(400).json({ status: 'error', message: 'Company ID required' });
    }
    try {
      const data = await contractExtractService.approve(companyId, req.params.id);
      return void res.json({ status: 'success', data });
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
  '/:id/post',
  authorize({ resource: 'invoice', action: 'post' }),
  async (req: AuthRequest, res: Response) => {
    try {
      const ctx = postingContext(req);
      if (!ctx.fiscalYearId) {
        return void res.status(400).json({ status: 'error', message: 'X-Fiscal-Year-Id required' });
      }
      const data = await contractExtractService.post(ctx, req.params.id);
      return void res.json({ status: 'success', data });
    } catch (e) {
      const status = e instanceof AppError ? e.statusCode : 500;
      return void res.status(status).json({
        status: 'error',
        message: e instanceof Error ? e.message : 'Post extract failed',
      });
    }
  }
);

router.post(
  '/:id/unpost',
  authorize({ resource: 'invoice', action: 'post' }),
  async (req: AuthRequest, res: Response) => {
    try {
      const ctx = postingContext(req);
      if (!ctx.fiscalYearId) {
        return void res.status(400).json({ status: 'error', message: 'X-Fiscal-Year-Id required' });
      }
      const data = await contractExtractService.unpost(ctx, req.params.id);
      return void res.json({ status: 'success', data });
    } catch (e) {
      const status = e instanceof AppError ? e.statusCode : 500;
      return void res.status(status).json({
        status: 'error',
        message: e instanceof Error ? e.message : 'Unpost extract failed',
      });
    }
  }
);

export default router;
