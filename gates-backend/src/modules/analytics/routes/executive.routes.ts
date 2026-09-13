import { Router, Response } from 'express';
import { authenticate } from '../../../shared/middleware/auth.middleware';
import { authorize } from '../../../shared/middleware/authorize.middleware';
import { setTenantContext } from '../../../shared/middleware/tenant.middleware';
import { AppError } from '../../../shared/middleware/error-handler';
import type { AuthRequest } from '../../../shared/auth/types';
import { executiveDashboardService } from '../services/executive-dashboard.service';

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
      const data = await executiveDashboardService.getOverview({
        companyId: companyId(req),
        branchId: (req.query.branchId as string) || undefined,
      });
      return void res.json({ status: 'success', data });
    } catch (e) {
      const status = e instanceof AppError ? e.statusCode : 500;
      return void res.status(status).json({
        status: 'error',
        message: e instanceof Error ? e.message : 'Executive overview failed',
      });
    }
  }
);

router.get(
  '/risk-feed',
  authorize({ resource: 'report', action: 'view' }),
  async (req: AuthRequest, res: Response) => {
    try {
      const data = await executiveDashboardService.getRiskFeed({
        companyId: companyId(req),
        branchId: (req.query.branchId as string) || undefined,
      });
      return void res.json({ status: 'success', data });
    } catch (e) {
      const status = e instanceof AppError ? e.statusCode : 500;
      return void res.status(status).json({
        status: 'error',
        message: e instanceof Error ? e.message : 'Executive risk feed failed',
      });
    }
  }
);

router.get(
  '/analytics',
  authorize({ resource: 'report', action: 'view' }),
  async (req: AuthRequest, res: Response) => {
    try {
      const data = await executiveDashboardService.getAnalytics({
        companyId: companyId(req),
        branchId: (req.query.branchId as string) || undefined,
      });
      return void res.json({ status: 'success', data });
    } catch (e) {
      const status = e instanceof AppError ? e.statusCode : 500;
      return void res.status(status).json({
        status: 'error',
        message: e instanceof Error ? e.message : 'Executive analytics failed',
      });
    }
  }
);

export default router;
