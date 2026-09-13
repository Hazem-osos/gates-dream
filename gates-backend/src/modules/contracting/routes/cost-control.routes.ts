import { Router } from 'express';
import type { AuthRequest } from '../../../shared/auth/types';
import { asyncHandler } from '../../../shared/middleware/async-handler';
import { authenticate } from '../../../shared/middleware/auth.middleware';
import { authorize } from '../../../shared/middleware/authorize.middleware';
import { AppError } from '../../../shared/middleware/error-handler';
import { setTenantContext } from '../../../shared/middleware/tenant.middleware';
import { validateParams, validateQuery } from '../../../shared/middleware/validate';
import { evmQuerySchema, projectIdParamSchema } from '../schemas/contracting.validation';
import { projectCostControlService } from '../cost-control/services/ProjectCostControlService';

const router = Router();
router.use(authenticate);
router.use(setTenantContext);

function requireCompanyId(req: AuthRequest): string {
  const companyId = req.companyId ?? req.tenantId;
  if (!companyId) throw new AppError(400, 'Company ID is required');
  return companyId;
}

router.get(
  '/projects/:projectId/evm',
  authorize({ resource: 'project', action: 'view' }),
  validateParams(projectIdParamSchema),
  validateQuery(evmQuerySchema),
  asyncHandler(async (req, res) => {
    const { asOfDate } = req.query as { asOfDate?: Date };
    const data = await projectCostControlService.getProjectEvmDashboard(
      requireCompanyId(req as AuthRequest),
      req.params.projectId,
      { asOfDate }
    );
    res.json({ status: 'success', data });
  })
);

router.get(
  '/projects/:projectId/budget-vs-actual',
  authorize({ resource: 'project', action: 'view' }),
  validateParams(projectIdParamSchema),
  validateQuery(evmQuerySchema),
  asyncHandler(async (req, res) => {
    const { asOfDate } = req.query as { asOfDate?: Date };
    const data = await projectCostControlService.getBudgetVsActual(
      requireCompanyId(req as AuthRequest),
      req.params.projectId,
      { asOfDate }
    );
    res.json({ status: 'success', data });
  })
);

export default router;
