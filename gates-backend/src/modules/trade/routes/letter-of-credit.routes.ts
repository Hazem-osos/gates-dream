import { Router, Response } from 'express';
import { authenticate } from '../../../shared/middleware/auth.middleware';
import { authorize } from '../../../shared/middleware/authorize.middleware';
import { setTenantContext } from '../../../shared/middleware/tenant.middleware';
import { AppError } from '../../../shared/middleware/error-handler';
import type { AuthRequest } from '../../../shared/auth/types';
import { isAdminRequest } from '../../../shared/auth/roles.util';
import { journalEntryService } from '../../accounting/services/journal-entry.service';
import { letterOfCreditService } from '../services/letter-of-credit.service';

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
      const data = await letterOfCreditService.open(ctx, req.body);
      return void res.status(201).json({ status: 'success', data });
    } catch (e) {
      const status = e instanceof AppError ? e.statusCode : 500;
      return void res.status(status).json({
        status: 'error',
        message: e instanceof Error ? e.message : 'Open LC failed',
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
      const data = await letterOfCreditService.getById(companyId, req.params.id);
      return void res.json({ status: 'success', data });
    } catch (e) {
      const status = e instanceof AppError ? e.statusCode : 500;
      return void res.status(status).json({
        status: 'error',
        message: e instanceof Error ? e.message : 'Get LC failed',
      });
    }
  }
);

router.post(
  '/:id/expenses',
  authorize({ resource: 'import-export', action: 'edit' }),
  async (req: AuthRequest, res: Response) => {
    try {
      const ctx = postingContext(req);
      if (!ctx.fiscalYearId) {
        return void res.status(400).json({ status: 'error', message: 'X-Fiscal-Year-Id required' });
      }
      const data = await letterOfCreditService.addExpense(ctx, req.params.id, req.body);
      return void res.status(201).json({ status: 'success', data });
    } catch (e) {
      const status = e instanceof AppError ? e.statusCode : 500;
      return void res.status(status).json({
        status: 'error',
        message: e instanceof Error ? e.message : 'LC expense failed',
      });
    }
  }
);

router.post(
  '/:id/clear',
  authorize({ resource: 'import-export', action: 'edit' }),
  async (req: AuthRequest, res: Response) => {
    try {
      const ctx = postingContext(req);
      if (!ctx.fiscalYearId) {
        return void res.status(400).json({ status: 'error', message: 'X-Fiscal-Year-Id required' });
      }
      const lines = req.body?.lines ?? req.body;
      if (!Array.isArray(lines)) {
        return void res.status(400).json({ status: 'error', message: 'lines array required' });
      }
      const data = await letterOfCreditService.clear(ctx, req.params.id, lines);
      return void res.json({ status: 'success', data });
    } catch (e) {
      const status = e instanceof AppError ? e.statusCode : 500;
      return void res.status(status).json({
        status: 'error',
        message: e instanceof Error ? e.message : 'LC clear failed',
      });
    }
  }
);

router.post(
  '/:id/unclose',
  authorize({ resource: 'import-export', action: 'edit' }),
  async (req: AuthRequest, res: Response) => {
    try {
      const ctx = postingContext(req);
      const data = await letterOfCreditService.unclose(ctx, req.params.id);
      return void res.json({ status: 'success', data });
    } catch (e) {
      const status = e instanceof AppError ? e.statusCode : 500;
      return void res.status(status).json({
        status: 'error',
        message: e instanceof Error ? e.message : 'LC unclose failed',
      });
    }
  }
);

export default router;
