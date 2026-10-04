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
  if (!companyId) throw new AppError(400, 'معرّف الشركة مطلوب');
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

router.get(
  '/projects/:projectId/actual-cost/summary',
  authorize({ resource: 'project', action: 'view' }),
  validateParams(projectIdParamSchema),
  asyncHandler(async (req, res) => {
    const { projectCostQueryService } = await import('../project-cost/project-cost-query.service');
    const data = await projectCostQueryService.getProjectSummary(
      requireCompanyId(req as AuthRequest),
      req.params.projectId
    );
    res.json({ status: 'success', data });
  })
);

router.get(
  '/projects/:projectId/actual-cost/boq',
  authorize({ resource: 'project', action: 'view' }),
  validateParams(projectIdParamSchema),
  asyncHandler(async (req, res) => {
    const { projectCostQueryService } = await import('../project-cost/project-cost-query.service');
    const data = await projectCostQueryService.getBoqBreakdown(
      requireCompanyId(req as AuthRequest),
      req.params.projectId
    );
    res.json({ status: 'success', data });
  })
);

router.get(
  '/projects/:projectId/actual-cost/sources',
  authorize({ resource: 'project', action: 'view' }),
  validateParams(projectIdParamSchema),
  asyncHandler(async (req, res) => {
    const { projectCostQueryService } = await import('../project-cost/project-cost-query.service');
    const q = req.query as { projectBOQItemId?: string; costCategory?: string };
    const data = await projectCostQueryService.listSources(
      requireCompanyId(req as AuthRequest),
      req.params.projectId,
      {
        projectBOQItemId: q.projectBOQItemId,
        costCategory: q.costCategory as never,
      }
    );
    res.json({ status: 'success', data });
  })
);

router.get(
  '/projects/:projectId/actual-cost/integrity',
  authorize({ resource: 'project', action: 'view' }),
  validateParams(projectIdParamSchema),
  asyncHandler(async (req, res) => {
    const { projectCostIntegrityService } = await import(
      '../project-cost/project-cost-integrity.service'
    );
    const data = await projectCostIntegrityService.reconcileProject(
      requireCompanyId(req as AuthRequest),
      req.params.projectId
    );
    res.json({ status: 'success', data });
  })
);

router.get(
  '/projects/:projectId/profitability/summary',
  authorize({ resource: 'project', action: 'view' }),
  validateParams(projectIdParamSchema),
  asyncHandler(async (req, res) => {
    const { projectProfitabilityService } = await import('../profitability/project-profitability.service');
    const data = await projectProfitabilityService.getProjectSummary(
      requireCompanyId(req as AuthRequest),
      req.params.projectId
    );
    res.json({ status: 'success', data });
  })
);

router.get(
  '/projects/:projectId/profitability/boq',
  authorize({ resource: 'project', action: 'view' }),
  validateParams(projectIdParamSchema),
  asyncHandler(async (req, res) => {
    const { projectProfitabilityService } = await import('../profitability/project-profitability.service');
    const data = await projectProfitabilityService.getBoqBreakdown(
      requireCompanyId(req as AuthRequest),
      req.params.projectId
    );
    res.json({ status: 'success', data });
  })
);

router.get(
  '/projects/:projectId/profitability/commitments',
  authorize({ resource: 'project', action: 'view' }),
  validateParams(projectIdParamSchema),
  asyncHandler(async (req, res) => {
    const { projectProfitabilityService } = await import('../profitability/project-profitability.service');
    const data = await projectProfitabilityService.getCommitmentBreakdown(
      requireCompanyId(req as AuthRequest),
      req.params.projectId
    );
    res.json({ status: 'success', data });
  })
);

router.get(
  '/projects/:projectId/profitability/forecast',
  authorize({ resource: 'project', action: 'view' }),
  validateParams(projectIdParamSchema),
  asyncHandler(async (req, res) => {
    const { projectProfitabilityService } = await import('../profitability/project-profitability.service');
    const data = await projectProfitabilityService.getForecastDetail(
      requireCompanyId(req as AuthRequest),
      req.params.projectId
    );
    res.json({ status: 'success', data });
  })
);

router.get(
  '/projects/:projectId/profitability/boq/:projectBOQItemId/drilldown',
  authorize({ resource: 'project', action: 'view' }),
  validateParams(projectIdParamSchema),
  asyncHandler(async (req, res) => {
    const { projectProfitabilityService } = await import('../profitability/project-profitability.service');
    const data = await projectProfitabilityService.getBoqDrilldown(
      requireCompanyId(req as AuthRequest),
      req.params.projectId,
      req.params.projectBOQItemId
    );
    res.json({ status: 'success', data });
  })
);

router.get(
  '/projects/:projectId/profitability/snapshots',
  authorize({ resource: 'project', action: 'view' }),
  validateParams(projectIdParamSchema),
  asyncHandler(async (req, res) => {
    const { projectProfitabilitySnapshotService } = await import(
      '../profitability/project-profitability-snapshot.service'
    );
    const data = await projectProfitabilitySnapshotService.listSnapshots(
      requireCompanyId(req as AuthRequest),
      req.params.projectId
    );
    res.json({ status: 'success', data });
  })
);

router.post(
  '/projects/:projectId/profitability/snapshots',
  authorize({ resource: 'project', action: 'view' }),
  validateParams(projectIdParamSchema),
  asyncHandler(async (req, res) => {
    const { projectProfitabilitySnapshotService } = await import(
      '../profitability/project-profitability-snapshot.service'
    );
    const auth = req as AuthRequest;
    const body = req.body as { label?: string };
    const data = await projectProfitabilitySnapshotService.createSnapshot(
      requireCompanyId(auth),
      req.params.projectId,
      { label: body.label, createdBy: auth.userId }
    );
    res.status(201).json({ status: 'success', data });
  })
);

router.get(
  '/projects/:projectId/profitability/integrity',
  authorize({ resource: 'project', action: 'view' }),
  validateParams(projectIdParamSchema),
  asyncHandler(async (req, res) => {
    const { projectProfitabilityIntegrityService } = await import(
      '../profitability/project-profitability-integrity.service'
    );
    const data = await projectProfitabilityIntegrityService.reconcileProject(
      requireCompanyId(req as AuthRequest),
      req.params.projectId
    );
    res.json({ status: 'success', data });
  })
);

export default router;
