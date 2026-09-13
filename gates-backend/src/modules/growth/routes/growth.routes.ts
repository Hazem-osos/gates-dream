import { Router, Response } from 'express';
import { authenticate } from '../../../shared/middleware/auth.middleware';
import { authorize } from '../../../shared/middleware/authorize.middleware';
import { setTenantContext } from '../../../shared/middleware/tenant.middleware';
import { AppError } from '../../../shared/middleware/error-handler';
import type { AuthRequest } from '../../../shared/auth/types';
import { growthEngineService } from '../services/growth-engine.service';
import { growthImpactService } from '../services/growth-impact.service';

const router = Router();
router.use(authenticate);
router.use(setTenantContext);

function companyId(req: AuthRequest): string {
  const id = req.companyId ?? req.tenantId;
  if (!id) throw new AppError(400, 'Company ID is required');
  return id;
}

router.get(
  '/overview',
  authorize({ resource: 'report', action: 'view' }),
  async (req: AuthRequest, res: Response) => {
    try {
      const data = await growthEngineService.getOverview(companyId(req));
      return void res.json({ status: 'success', data });
    } catch (e) {
      const status = e instanceof AppError ? e.statusCode : 500;
      return void res.status(status).json({
        status: 'error',
        message: e instanceof Error ? e.message : 'Growth overview failed',
      });
    }
  }
);

router.post(
  '/refresh',
  authorize({ resource: 'report', action: 'view' }),
  async (req: AuthRequest, res: Response) => {
    try {
      const data = await growthEngineService.refresh(companyId(req));
      return void res.json({ status: 'success', data });
    } catch (e) {
      const status = e instanceof AppError ? e.statusCode : 500;
      return void res.status(status).json({
        status: 'error',
        message: e instanceof Error ? e.message : 'Growth refresh failed',
      });
    }
  }
);

router.get(
  '/impact',
  authorize({ resource: 'report', action: 'view' }),
  async (req: AuthRequest, res: Response) => {
    try {
      const data = await growthImpactService.getImpact(companyId(req));
      return void res.json({ status: 'success', data });
    } catch (e) {
      const status = e instanceof AppError ? e.statusCode : 500;
      return void res.status(status).json({
        status: 'error',
        message: e instanceof Error ? e.message : 'Growth impact failed',
      });
    }
  }
);

router.get(
  '/:id',
  authorize({ resource: 'report', action: 'view' }),
  async (req: AuthRequest, res: Response) => {
    try {
      const data = await growthEngineService.getById(companyId(req), req.params.id);
      if (!data) return void res.status(404).json({ status: 'error', message: 'Opportunity not found' });
      return void res.json({ status: 'success', data });
    } catch (e) {
      const status = e instanceof AppError ? e.statusCode : 500;
      return void res.status(status).json({
        status: 'error',
        message: e instanceof Error ? e.message : 'Growth detail failed',
      });
    }
  }
);

router.post(
  '/:id/review',
  authorize({ resource: 'report', action: 'edit' }),
  async (req: AuthRequest, res: Response) => {
    try {
      const data = await growthEngineService.review(companyId(req), req.params.id, req.user?.sub);
      if (!data) return void res.status(404).json({ status: 'error', message: 'Opportunity not found' });
      return void res.json({ status: 'success', data });
    } catch (e) {
      const status = e instanceof AppError ? e.statusCode : 500;
      return void res.status(status).json({
        status: 'error',
        message: e instanceof Error ? e.message : 'Review failed',
      });
    }
  }
);

router.post(
  '/:id/dismiss',
  authorize({ resource: 'report', action: 'edit' }),
  async (req: AuthRequest, res: Response) => {
    try {
      const data = await growthEngineService.dismiss(
        companyId(req),
        req.params.id,
        req.user?.sub,
        typeof req.body?.notes === 'string' ? req.body.notes : undefined
      );
      if (!data) return void res.status(404).json({ status: 'error', message: 'Opportunity not found' });
      return void res.json({ status: 'success', data });
    } catch (e) {
      const status = e instanceof AppError ? e.statusCode : 500;
      return void res.status(status).json({
        status: 'error',
        message: e instanceof Error ? e.message : 'Dismiss failed',
      });
    }
  }
);

router.post(
  '/:id/actions',
  authorize({ resource: 'report', action: 'edit' }),
  async (req: AuthRequest, res: Response) => {
    try {
      const actionKey = String(req.body?.actionKey || '').trim();
      const label = String(req.body?.label || actionKey).trim();
      if (!actionKey) return void res.status(400).json({ status: 'error', message: 'actionKey required' });
      const data = await growthEngineService.recordAction(
        companyId(req),
        req.params.id,
        actionKey,
        label,
        req.user?.sub,
        typeof req.body?.notes === 'string' ? req.body.notes : undefined
      );
      if (!data) return void res.status(404).json({ status: 'error', message: 'Opportunity not found' });
      return void res.json({ status: 'success', data });
    } catch (e) {
      const status = e instanceof AppError ? e.statusCode : 500;
      return void res.status(status).json({
        status: 'error',
        message: e instanceof Error ? e.message : 'Action failed',
      });
    }
  }
);

export default router;
