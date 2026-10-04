import { Router } from 'express';
import type { AuthRequest } from '../../../shared/auth/types';
import { asyncHandler } from '../../../shared/middleware/async-handler';
import { authenticate } from '../../../shared/middleware/auth.middleware';
import { authorize } from '../../../shared/middleware/authorize.middleware';
import { AppError } from '../../../shared/middleware/error-handler';
import { setTenantContext } from '../../../shared/middleware/tenant.middleware';
import { validateParams } from '../../../shared/middleware/validate';
import { projectIdParamSchema } from '../schemas/contracting.validation';
import { projectExecutionIntegrityService } from '../execution/project-execution-integrity.service';
import { projectExecutionPerformanceService } from '../execution/project-execution-performance.service';
import { projectExecutionPlanService } from '../execution/project-execution-plan.service';
import { projectExecutionSnapshotService } from '../execution/project-execution-snapshot.service';

const router = Router();
router.use(authenticate);
router.use(setTenantContext);

function requireCompanyId(req: AuthRequest): string {
  const companyId = req.companyId ?? req.tenantId;
  if (!companyId) throw new AppError(400, 'معرّف الشركة مطلوب');
  return companyId;
}

function parseAsOf(q: Record<string, unknown>): Date | undefined {
  const raw = q.asOfDate;
  if (typeof raw !== 'string' || !raw) return undefined;
  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? undefined : d;
}

router.get(
  '/projects/:projectId/plans',
  authorize({ resource: 'project', action: 'view' }),
  validateParams(projectIdParamSchema),
  asyncHandler(async (req, res) => {
    const data = await projectExecutionPlanService.listPlans(
      requireCompanyId(req as AuthRequest),
      req.params.projectId
    );
    res.json({ status: 'success', data });
  })
);

router.get(
  '/projects/:projectId/plans/active',
  authorize({ resource: 'project', action: 'view' }),
  validateParams(projectIdParamSchema),
  asyncHandler(async (req, res) => {
    const data = await projectExecutionPlanService.getActivePlan(
      requireCompanyId(req as AuthRequest),
      req.params.projectId
    );
    res.json({ status: 'success', data });
  })
);

router.get(
  '/projects/:projectId/plans/draft',
  authorize({ resource: 'project', action: 'view' }),
  validateParams(projectIdParamSchema),
  asyncHandler(async (req, res) => {
    const data = await projectExecutionPlanService.getDraftPlan(
      requireCompanyId(req as AuthRequest),
      req.params.projectId
    );
    res.json({ status: 'success', data });
  })
);

router.patch(
  '/plans/:planId',
  authorize({ resource: 'project', action: 'edit' }),
  asyncHandler(async (req, res) => {
    const body = req.body as { planName?: string; plannedStart?: string; plannedFinish?: string };
    const data = await projectExecutionPlanService.updateDraftPlan(
      requireCompanyId(req as AuthRequest),
      req.params.planId,
      {
        planName: body.planName,
        plannedStart: body.plannedStart ? new Date(body.plannedStart) : undefined,
        plannedFinish: body.plannedFinish ? new Date(body.plannedFinish) : undefined,
      }
    );
    res.json({ status: 'success', data });
  })
);

router.post(
  '/projects/:projectId/plans/revision',
  authorize({ resource: 'project', action: 'edit' }),
  validateParams(projectIdParamSchema),
  asyncHandler(async (req, res) => {
    const auth = req as AuthRequest;
    const data = await projectExecutionPlanService.createRevisionFromActive(
      requireCompanyId(auth),
      req.params.projectId,
      auth.userId
    );
    res.status(201).json({ status: 'success', data });
  })
);

router.delete(
  '/activities/:activityId',
  authorize({ resource: 'project', action: 'edit' }),
  asyncHandler(async (req, res) => {
    const data = await projectExecutionPlanService.deleteActivity(
      requireCompanyId(req as AuthRequest),
      req.params.activityId
    );
    res.json({ status: 'success', data });
  })
);

router.delete(
  '/activities/:activityId/boq-allocations/:projectBOQItemId',
  authorize({ resource: 'project', action: 'edit' }),
  asyncHandler(async (req, res) => {
    const data = await projectExecutionPlanService.deleteBoqAllocation(
      requireCompanyId(req as AuthRequest),
      req.params.activityId,
      req.params.projectBOQItemId
    );
    res.json({ status: 'success', data });
  })
);

router.delete(
  '/milestones/:milestoneId',
  authorize({ resource: 'project', action: 'edit' }),
  asyncHandler(async (req, res) => {
    const data = await projectExecutionPlanService.deleteMilestone(
      requireCompanyId(req as AuthRequest),
      req.params.milestoneId
    );
    res.json({ status: 'success', data });
  })
);

router.post(
  '/projects/:projectId/plans',
  authorize({ resource: 'project', action: 'edit' }),
  validateParams(projectIdParamSchema),
  asyncHandler(async (req, res) => {
    const auth = req as AuthRequest;
    const body = req.body as {
      planName: string;
      plannedStart: string;
      plannedFinish: string;
      revisionOfPlanId?: string;
    };
    const data = await projectExecutionPlanService.createPlan(
      requireCompanyId(auth),
      req.params.projectId,
      {
        planName: body.planName,
        plannedStart: new Date(body.plannedStart),
        plannedFinish: new Date(body.plannedFinish),
        createdBy: auth.userId,
        revisionOfPlanId: body.revisionOfPlanId,
      }
    );
    res.status(201).json({ status: 'success', data });
  })
);

router.post(
  '/plans/:planId/activities',
  authorize({ resource: 'project', action: 'edit' }),
  asyncHandler(async (req, res) => {
    const auth = req as AuthRequest;
    const body = req.body as {
      activityId?: string;
      code: string;
      nameAr: string;
      plannedStart: string;
      plannedFinish: string;
      weight?: number;
      sortOrder?: number;
    };
    const data = await projectExecutionPlanService.upsertActivity(
      requireCompanyId(auth),
      req.params.planId,
      {
        ...body,
        plannedStart: new Date(body.plannedStart),
        plannedFinish: new Date(body.plannedFinish),
      }
    );
    res.status(201).json({ status: 'success', data });
  })
);

router.post(
  '/activities/:activityId/boq-allocations',
  authorize({ resource: 'project', action: 'edit' }),
  asyncHandler(async (req, res) => {
    const body = req.body as { projectBOQItemId: string; plannedQuantity: number };
    const data = await projectExecutionPlanService.setBoqAllocation(
      requireCompanyId(req as AuthRequest),
      req.params.activityId,
      body
    );
    res.json({ status: 'success', data });
  })
);

router.post(
  '/plans/:planId/approve',
  authorize({ resource: 'project', action: 'edit' }),
  asyncHandler(async (req, res) => {
    const auth = req as AuthRequest;
    const data = await projectExecutionPlanService.approvePlan(
      requireCompanyId(auth),
      req.params.planId,
      auth.userId
    );
    res.json({ status: 'success', data });
  })
);

router.post(
  '/plans/:planId/activate',
  authorize({ resource: 'project', action: 'edit' }),
  asyncHandler(async (req, res) => {
    const data = await projectExecutionPlanService.activatePlan(
      requireCompanyId(req as AuthRequest),
      req.params.planId
    );
    res.json({ status: 'success', data });
  })
);

router.post(
  '/projects/:projectId/milestones',
  authorize({ resource: 'project', action: 'edit' }),
  validateParams(projectIdParamSchema),
  asyncHandler(async (req, res) => {
    const body = req.body as {
      milestoneId?: string;
      executionPlanId?: string;
      nameAr: string;
      plannedDate: string;
      actualDate?: string | null;
    };
    const data = await projectExecutionPlanService.upsertMilestone(
      requireCompanyId(req as AuthRequest),
      req.params.projectId,
      {
        ...body,
        plannedDate: new Date(body.plannedDate),
        actualDate: body.actualDate ? new Date(body.actualDate) : null,
      }
    );
    res.json({ status: 'success', data });
  })
);

router.get(
  '/projects/:projectId/performance/summary',
  authorize({ resource: 'project', action: 'view' }),
  validateParams(projectIdParamSchema),
  asyncHandler(async (req, res) => {
    const data = await projectExecutionPerformanceService.getPerformanceSummary(
      requireCompanyId(req as AuthRequest),
      req.params.projectId,
      { asOfDate: parseAsOf(req.query as Record<string, unknown>) }
    );
    res.json({ status: 'success', data });
  })
);

router.get(
  '/projects/:projectId/performance/activities',
  authorize({ resource: 'project', action: 'view' }),
  validateParams(projectIdParamSchema),
  asyncHandler(async (req, res) => {
    const data = await projectExecutionPerformanceService.getActivityPerformance(
      requireCompanyId(req as AuthRequest),
      req.params.projectId,
      { asOfDate: parseAsOf(req.query as Record<string, unknown>) }
    );
    res.json({ status: 'success', data });
  })
);

router.get(
  '/projects/:projectId/performance/time-series',
  authorize({ resource: 'project', action: 'view' }),
  validateParams(projectIdParamSchema),
  asyncHandler(async (req, res) => {
    const q = req.query as { from?: string; to?: string; stepDays?: string };
    const data = await projectExecutionPerformanceService.getTimeSeries(
      requireCompanyId(req as AuthRequest),
      req.params.projectId,
      {
        from: q.from ? new Date(q.from) : undefined,
        to: q.to ? new Date(q.to) : undefined,
        stepDays: q.stepDays ? Number(q.stepDays) : undefined,
      }
    );
    res.json({ status: 'success', data });
  })
);

router.get(
  '/projects/:projectId/unplanned-scope',
  authorize({ resource: 'project', action: 'view' }),
  validateParams(projectIdParamSchema),
  asyncHandler(async (req, res) => {
    const data = await projectExecutionPerformanceService.getUnplannedScope(
      requireCompanyId(req as AuthRequest),
      req.params.projectId
    );
    res.json({ status: 'success', data });
  })
);

router.get(
  '/plans/:planId/allocation-summary',
  authorize({ resource: 'project', action: 'view' }),
  asyncHandler(async (req, res) => {
    const q = req.query as { projectId?: string };
    if (!q.projectId) throw new AppError(400, 'projectId مطلوب');
    const data = await projectExecutionPerformanceService.getAllocationSummary(
      requireCompanyId(req as AuthRequest),
      q.projectId,
      req.params.planId
    );
    res.json({ status: 'success', data });
  })
);

router.get(
  '/projects/:projectId/performance/snapshots',
  authorize({ resource: 'project', action: 'view' }),
  validateParams(projectIdParamSchema),
  asyncHandler(async (req, res) => {
    const data = await projectExecutionSnapshotService.listSnapshots(
      requireCompanyId(req as AuthRequest),
      req.params.projectId
    );
    res.json({ status: 'success', data });
  })
);

router.post(
  '/projects/:projectId/performance/snapshots',
  authorize({ resource: 'project', action: 'view' }),
  validateParams(projectIdParamSchema),
  asyncHandler(async (req, res) => {
    const auth = req as AuthRequest;
    const body = req.body as { label?: string; asOfDate?: string };
    const data = await projectExecutionSnapshotService.createSnapshot(
      requireCompanyId(auth),
      req.params.projectId,
      {
        label: body.label,
        asOfDate: body.asOfDate ? new Date(body.asOfDate) : undefined,
        createdBy: auth.userId,
      }
    );
    res.status(201).json({ status: 'success', data });
  })
);

router.get(
  '/projects/:projectId/integrity',
  authorize({ resource: 'project', action: 'view' }),
  validateParams(projectIdParamSchema),
  asyncHandler(async (req, res) => {
    const data = await projectExecutionIntegrityService.reconcileProject(
      requireCompanyId(req as AuthRequest),
      req.params.projectId
    );
    res.json({ status: 'success', data });
  })
);

export default router;
