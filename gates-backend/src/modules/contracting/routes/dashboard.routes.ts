import { Router } from 'express';
import type { AuthRequest } from '../../../shared/auth/types';
import { asyncHandler } from '../../../shared/middleware/async-handler';
import { authenticate } from '../../../shared/middleware/auth.middleware';
import { authorize } from '../../../shared/middleware/authorize.middleware';
import { AppError } from '../../../shared/middleware/error-handler';
import { setTenantContext } from '../../../shared/middleware/tenant.middleware';
import prisma from '../../../shared/database/prisma';
import { contractingDashboardService } from '../dashboard/contracting-dashboard.service';
import { contractingReportsService } from '../reports/contracting-reports.service';

const DEMO_PROJECT_PREFIX = 'DEMO-H-RAIL';

const router = Router();
router.use(authenticate);
router.use(setTenantContext);

function requireCompanyId(req: AuthRequest): string {
  const companyId = req.companyId ?? req.tenantId;
  if (!companyId) throw new AppError(400, 'معرّف الشركة مطلوب');
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

router.get(
  '/demo-seed-status',
  authorize({ resource: 'project', action: 'view' }),
  asyncHandler(async (req, res) => {
    const companyId = requireCompanyId(req as AuthRequest);
    const demoProjects = await prisma.contractingProject.findMany({
      where: {
        companyId,
        projectCode: { startsWith: DEMO_PROJECT_PREFIX },
        status: 'ACTIVE',
      },
      select: { projectCode: true },
      orderBy: { projectCode: 'asc' },
    });
    const active = demoProjects.length > 0;
    let portfolioPreview: Record<string, number> | undefined;
    if (active) {
      const dash = await contractingReportsService.getManagementDashboard(companyId);
      portfolioPreview = {
        activeProjects: dash.portfolio.activeProjects,
        revisedContractValue: dash.portfolio.revisedContractValue,
        forecastProfit: dash.portfolio.forecastProfit,
      };
    }
    res.json({
      status: 'success',
      data: {
        active,
        marker: DEMO_PROJECT_PREFIX,
        projectCodes: demoProjects.map((p) => p.projectCode),
        portfolioPreview,
      },
    });
  })
);

export default router;
