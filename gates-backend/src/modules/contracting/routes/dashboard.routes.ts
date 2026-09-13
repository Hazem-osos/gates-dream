import { Router } from 'express';
import type { AuthRequest } from '../../../shared/auth/types';
import { asyncHandler } from '../../../shared/middleware/async-handler';
import { authenticate } from '../../../shared/middleware/auth.middleware';
import { authorize } from '../../../shared/middleware/authorize.middleware';
import { AppError } from '../../../shared/middleware/error-handler';
import { setTenantContext } from '../../../shared/middleware/tenant.middleware';
import { contractingDashboardService } from '../dashboard/contracting-dashboard.service';

const router = Router();
router.use(authenticate);
router.use(setTenantContext);

function requireCompanyId(req: AuthRequest): string {
  const companyId = req.companyId ?? req.tenantId;
  if (!companyId) throw new AppError(400, 'Company ID is required');
  return companyId;
}

router.get(
  '/summary',
  authorize({ resource: 'project', action: 'view' }),
  asyncHandler(async (req, res) => {
    const data = await contractingDashboardService.getSummary(requireCompanyId(req as AuthRequest));
    res.json({ status: 'success', data });
  })
);

export default router;
