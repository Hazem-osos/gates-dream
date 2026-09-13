import { Router, Response } from 'express';
import { authenticate } from '../../../shared/middleware/auth.middleware';
import { authorize } from '../../../shared/middleware/authorize.middleware';
import { setTenantContext } from '../../../shared/middleware/tenant.middleware';
import { AppError } from '../../../shared/middleware/error-handler';
import type { AuthRequest } from '../../../shared/auth/types';
import { isAdminRequest } from '../../../shared/auth/roles.util';
import { journalEntryService } from '../../accounting/services/journal-entry.service';
import { letterOfGuaranteeService } from '../services/letter-of-guarantee.service';

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
  authorize({ resource: 'import-export', action: 'edit' }),
  async (req: AuthRequest, res: Response) => {
    try {
      const ctx = postingContext(req);
      if (!ctx.fiscalYearId) {
        return void res.status(400).json({ status: 'error', message: 'X-Fiscal-Year-Id required' });
      }
      const body = req.body;
      const data = await letterOfGuaranteeService.issue(ctx, {
        ...body,
        issueDate: body.issueDate ? new Date(body.issueDate) : new Date(),
        expiryDate: body.expiryDate ? new Date(body.expiryDate) : undefined,
      });
      return void res.status(201).json({ status: 'success', data });
    } catch (e) {
      const status = e instanceof AppError ? e.statusCode : 500;
      return void res.status(status).json({
        status: 'error',
        message: e instanceof Error ? e.message : 'Issue LG failed',
      });
    }
  }
);

router.get(
  '/:id',
  authorize({ resource: 'import-export', action: 'view' }),
  async (req: AuthRequest, res: Response) => {
    const companyId = req.companyId ?? req.tenantId;
    if (!companyId) {
      return void res.status(400).json({ status: 'error', message: 'Company ID required' });
    }
    try {
      const data = await letterOfGuaranteeService.getById(companyId, req.params.id);
      return void res.json({ status: 'success', data });
    } catch (e) {
      const status = e instanceof AppError ? e.statusCode : 500;
      return void res.status(status).json({
        status: 'error',
        message: e instanceof Error ? e.message : 'Get LG failed',
      });
    }
  }
);

router.post(
  '/:id/extend',
  authorize({ resource: 'import-export', action: 'edit' }),
  async (req: AuthRequest, res: Response) => {
    try {
      const ctx = postingContext(req);
      const expiry = req.body?.expiryDate;
      if (!expiry) {
        return void res.status(400).json({ status: 'error', message: 'expiryDate required' });
      }
      const data = await letterOfGuaranteeService.extend(
        ctx,
        req.params.id,
        new Date(expiry)
      );
      return void res.json({ status: 'success', data });
    } catch (e) {
      const status = e instanceof AppError ? e.statusCode : 500;
      return void res.status(status).json({
        status: 'error',
        message: e instanceof Error ? e.message : 'Extend LG failed',
      });
    }
  }
);

router.post(
  '/:id/release',
  authorize({ resource: 'import-export', action: 'edit' }),
  async (req: AuthRequest, res: Response) => {
    try {
      const ctx = postingContext(req);
      if (!ctx.fiscalYearId) {
        return void res.status(400).json({ status: 'error', message: 'X-Fiscal-Year-Id required' });
      }
      const data = await letterOfGuaranteeService.release(ctx, req.params.id);
      return void res.json({ status: 'success', data });
    } catch (e) {
      const status = e instanceof AppError ? e.statusCode : 500;
      return void res.status(status).json({
        status: 'error',
        message: e instanceof Error ? e.message : 'Release LG failed',
      });
    }
  }
);

router.post(
  '/:id/confiscate',
  authorize({ resource: 'import-export', action: 'edit' }),
  async (req: AuthRequest, res: Response) => {
    try {
      const ctx = postingContext(req);
      const data = await letterOfGuaranteeService.confiscate(ctx, req.params.id);
      return void res.json({ status: 'success', data });
    } catch (e) {
      const status = e instanceof AppError ? e.statusCode : 500;
      return void res.status(status).json({
        status: 'error',
        message: e instanceof Error ? e.message : 'Confiscate LG failed',
      });
    }
  }
);

router.post(
  '/:id/unrelease',
  authorize({ resource: 'import-export', action: 'edit' }),
  async (req: AuthRequest, res: Response) => {
    try {
      const ctx = postingContext(req);
      const data = await letterOfGuaranteeService.unrelease(ctx, req.params.id);
      return void res.json({ status: 'success', data });
    } catch (e) {
      const status = e instanceof AppError ? e.statusCode : 500;
      return void res.status(status).json({
        status: 'error',
        message: e instanceof Error ? e.message : 'Unrelease LG failed',
      });
    }
  }
);

router.post(
  '/:id/unconfiscate',
  authorize({ resource: 'import-export', action: 'edit' }),
  async (req: AuthRequest, res: Response) => {
    try {
      const ctx = postingContext(req);
      const data = await letterOfGuaranteeService.unconfiscate(ctx, req.params.id);
      return void res.json({ status: 'success', data });
    } catch (e) {
      const status = e instanceof AppError ? e.statusCode : 500;
      return void res.status(status).json({
        status: 'error',
        message: e instanceof Error ? e.message : 'Unconfiscate LG failed',
      });
    }
  }
);

export default router;
