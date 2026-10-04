import { Router } from 'express';
import type { AuthRequest } from '../../../shared/auth/types';
import { asyncHandler } from '../../../shared/middleware/async-handler';
import { authenticate } from '../../../shared/middleware/auth.middleware';
import { authorize } from '../../../shared/middleware/authorize.middleware';
import { AppError } from '../../../shared/middleware/error-handler';
import { setTenantContext } from '../../../shared/middleware/tenant.middleware';
import { validateParams, validateQuery } from '../../../shared/middleware/validate';
import { z } from 'zod';
import {
  CONTRACTING_REPORT_CATALOG,
  CONTRACTING_REPORT_GROUPS,
} from './contracting-reports-catalog';
import { contractingReportsService } from './contracting-reports.service';
import { contractingReportsIntegrityService } from './contracting-reports-integrity.service';
import { getCustomerPartyStatement, getSubcontractorPartyStatement } from '../reconciliation/contracting-party-statement.service';

const router = Router();
router.use(authenticate);
router.use(setTenantContext);

const reportQuerySchema = z.object({
  projectId: z.string().uuid().optional(),
  customerId: z.string().uuid().optional(),
  subcontractorId: z.string().uuid().optional(),
  dateFrom: z.coerce.date().optional(),
  dateTo: z.coerce.date().optional(),
  tenderStatus: z.string().optional(),
  costCategory: z
    .enum([
      'MATERIAL',
      'LABOR',
      'SUBCONTRACTOR',
      'EQUIPMENT',
      'DIRECT_EXPENSE',
      'PURCHASE',
      'OVERHEAD',
      'OTHER',
    ])
    .optional(),
  sort: z.enum(['profit_desc', 'margin_asc', 'loss_desc', 'overrun_desc']).optional(),
});

const projectParamSchema = z.object({ projectId: z.string().uuid() });

function requireCompanyId(req: AuthRequest): string {
  const companyId = req.companyId ?? req.tenantId;
  if (!companyId) throw new AppError(400, 'معرّف الشركة مطلوب');
  return companyId;
}

function parseFilters(q: z.infer<typeof reportQuerySchema>) {
  return {
    projectId: q.projectId,
    customerId: q.customerId,
    subcontractorId: q.subcontractorId,
    dateFrom: q.dateFrom,
    dateTo: q.dateTo,
    tenderStatus: q.tenderStatus,
    costCategory: q.costCategory,
    sort: q.sort,
  };
}

router.get(
  '/catalog',
  authorize({ resource: 'project', action: 'view' }),
  asyncHandler(async (_req, res) => {
    res.json({
      status: 'success',
      data: { groups: CONTRACTING_REPORT_GROUPS, reports: CONTRACTING_REPORT_CATALOG },
    });
  })
);

router.get(
  '/integrity',
  authorize({ resource: 'project', action: 'view' }),
  validateQuery(reportQuerySchema.pick({ projectId: true })),
  asyncHandler(async (req, res) => {
    const q = req.query as { projectId?: string };
    const data = await contractingReportsIntegrityService.reconcileCompany(
      requireCompanyId(req as AuthRequest),
      q.projectId
    );
    res.json({ status: 'success', data });
  })
);

router.get(
  '/management-dashboard',
  authorize({ resource: 'project', action: 'view' }),
  asyncHandler(async (req, res) => {
    const data = await contractingReportsService.getManagementDashboard(requireCompanyId(req as AuthRequest));
    res.json({ status: 'success', data });
  })
);

router.get(
  '/project-master',
  authorize({ resource: 'project', action: 'view' }),
  validateQuery(reportQuerySchema),
  asyncHandler(async (req, res) => {
    const data = await contractingReportsService.getProjectMaster(
      requireCompanyId(req as AuthRequest),
      parseFilters(req.query as z.infer<typeof reportQuerySchema>)
    );
    res.json({ status: 'success', data: { items: data } });
  })
);

router.get(
  '/project-financial-position/:projectId',
  authorize({ resource: 'project', action: 'view' }),
  validateParams(projectParamSchema),
  asyncHandler(async (req, res) => {
    const data = await contractingReportsService.getProjectFinancialPosition(
      requireCompanyId(req as AuthRequest),
      req.params.projectId
    );
    res.json({ status: 'success', data });
  })
);

router.get(
  '/project-profitability',
  authorize({ resource: 'project', action: 'view' }),
  validateQuery(reportQuerySchema),
  asyncHandler(async (req, res) => {
    const data = await contractingReportsService.getProjectProfitabilityReport(
      requireCompanyId(req as AuthRequest),
      parseFilters(req.query as z.infer<typeof reportQuerySchema>)
    );
    res.json({ status: 'success', data });
  })
);

router.get(
  '/boq-profitability/:projectId',
  authorize({ resource: 'project', action: 'view' }),
  validateParams(projectParamSchema),
  asyncHandler(async (req, res) => {
    const data = await contractingReportsService.getBoqProfitability(
      requireCompanyId(req as AuthRequest),
      req.params.projectId
    );
    res.json({ status: 'success', data });
  })
);

router.get(
  '/budget-vs-actual-committed/:projectId',
  authorize({ resource: 'project', action: 'view' }),
  validateParams(projectParamSchema),
  asyncHandler(async (req, res) => {
    const data = await contractingReportsService.getBudgetVsActualCommitted(
      requireCompanyId(req as AuthRequest),
      req.params.projectId
    );
    res.json({ status: 'success', data });
  })
);

router.get(
  '/project-cost-detail/:projectId',
  authorize({ resource: 'project', action: 'view' }),
  validateParams(projectParamSchema),
  validateQuery(reportQuerySchema),
  asyncHandler(async (req, res) => {
    const filters = parseFilters(req.query as z.infer<typeof reportQuerySchema>);
    const data = await contractingReportsService.getProjectCostDetail(
      requireCompanyId(req as AuthRequest),
      { ...filters, projectId: req.params.projectId }
    );
    res.json({ status: 'success', data });
  })
);

router.get(
  '/unallocated-cost',
  authorize({ resource: 'project', action: 'view' }),
  validateQuery(reportQuerySchema.pick({ projectId: true })),
  asyncHandler(async (req, res) => {
    const q = req.query as { projectId?: string };
    const data = await contractingReportsService.getUnallocatedCost(
      requireCompanyId(req as AuthRequest),
      q.projectId
    );
    res.json({ status: 'success', data });
  })
);

router.get(
  '/cost-by-category',
  authorize({ resource: 'project', action: 'view' }),
  validateQuery(reportQuerySchema.pick({ projectId: true })),
  asyncHandler(async (req, res) => {
    const q = req.query as { projectId?: string };
    const data = await contractingReportsService.getCostByCategory(
      requireCompanyId(req as AuthRequest),
      q.projectId
    );
    res.json({ status: 'success', data });
  })
);

router.get(
  '/material-cost',
  authorize({ resource: 'project', action: 'view' }),
  validateQuery(reportQuerySchema),
  asyncHandler(async (req, res) => {
    const data = await contractingReportsService.getMaterialCost(
      requireCompanyId(req as AuthRequest),
      parseFilters(req.query as z.infer<typeof reportQuerySchema>)
    );
    res.json({ status: 'success', data });
  })
);

router.get(
  '/contract-value-vo',
  authorize({ resource: 'project', action: 'view' }),
  validateQuery(reportQuerySchema.pick({ projectId: true })),
  asyncHandler(async (req, res) => {
    const q = req.query as { projectId?: string };
    const data = await contractingReportsService.getContractValueVo(
      requireCompanyId(req as AuthRequest),
      q.projectId
    );
    res.json({ status: 'success', data });
  })
);

router.get(
  '/owner-certificates',
  authorize({ resource: 'project', action: 'view' }),
  validateQuery(reportQuerySchema),
  asyncHandler(async (req, res) => {
    const data = await contractingReportsService.getOwnerCertificates(
      requireCompanyId(req as AuthRequest),
      parseFilters(req.query as z.infer<typeof reportQuerySchema>)
    );
    res.json({ status: 'success', data });
  })
);

router.get(
  '/owner-certificate-summary',
  authorize({ resource: 'project', action: 'view' }),
  validateQuery(reportQuerySchema.pick({ projectId: true })),
  asyncHandler(async (req, res) => {
    const q = req.query as { projectId?: string };
    const data = await contractingReportsService.getOwnerCertificateSummary(
      requireCompanyId(req as AuthRequest),
      q.projectId
    );
    res.json({ status: 'success', data });
  })
);

router.get(
  '/collections',
  authorize({ resource: 'project', action: 'view' }),
  validateQuery(reportQuerySchema),
  asyncHandler(async (req, res) => {
    const data = await contractingReportsService.getCollections(
      requireCompanyId(req as AuthRequest),
      parseFilters(req.query as z.infer<typeof reportQuerySchema>)
    );
    res.json({ status: 'success', data });
  })
);

router.get(
  '/customer-statement/:customerId',
  authorize({ resource: 'project', action: 'view' }),
  validateQuery(reportQuerySchema.pick({ dateFrom: true, dateTo: true })),
  asyncHandler(async (req, res) => {
    const q = req.query as { dateFrom?: Date; dateTo?: Date };
    const data = await getCustomerPartyStatement(requireCompanyId(req as AuthRequest), req.params.customerId, {
      fromDate: q.dateFrom,
      toDate: q.dateTo,
    });
    res.json({ status: 'success', data });
  })
);

router.get(
  '/subcontractor-position',
  authorize({ resource: 'project', action: 'view' }),
  validateQuery(reportQuerySchema),
  asyncHandler(async (req, res) => {
    const data = await contractingReportsService.getSubcontractorPosition(
      requireCompanyId(req as AuthRequest),
      parseFilters(req.query as z.infer<typeof reportQuerySchema>)
    );
    res.json({ status: 'success', data });
  })
);

router.get(
  '/subcontractor-certificates',
  authorize({ resource: 'project', action: 'view' }),
  validateQuery(reportQuerySchema),
  asyncHandler(async (req, res) => {
    const data = await contractingReportsService.getSubcontractorCertificates(
      requireCompanyId(req as AuthRequest),
      parseFilters(req.query as z.infer<typeof reportQuerySchema>)
    );
    res.json({ status: 'success', data });
  })
);

router.get(
  '/subcontractor-statement/:subcontractorId',
  authorize({ resource: 'project', action: 'view' }),
  validateQuery(reportQuerySchema.pick({ dateFrom: true, dateTo: true })),
  asyncHandler(async (req, res) => {
    const q = req.query as { dateFrom?: Date; dateTo?: Date };
    const data = await getSubcontractorPartyStatement(
      requireCompanyId(req as AuthRequest),
      req.params.subcontractorId,
      { fromDate: q.dateFrom, toDate: q.dateTo }
    );
    res.json({ status: 'success', data });
  })
);

router.get(
  '/subcontract-commitment',
  authorize({ resource: 'project', action: 'view' }),
  validateQuery(reportQuerySchema.pick({ projectId: true })),
  asyncHandler(async (req, res) => {
    const q = req.query as { projectId?: string };
    const data = await contractingReportsService.getSubcontractCommitment(
      requireCompanyId(req as AuthRequest),
      q.projectId
    );
    res.json({ status: 'success', data });
  })
);

router.get(
  '/execution-progress',
  authorize({ resource: 'project', action: 'view' }),
  validateQuery(reportQuerySchema.pick({ projectId: true })),
  asyncHandler(async (req, res) => {
    const q = req.query as { projectId?: string };
    const data = await contractingReportsService.getExecutionProgress(
      requireCompanyId(req as AuthRequest),
      q.projectId
    );
    res.json({ status: 'success', data });
  })
);

router.get(
  '/activity-performance/:projectId',
  authorize({ resource: 'project', action: 'view' }),
  validateParams(projectParamSchema),
  asyncHandler(async (req, res) => {
    const data = await contractingReportsService.getActivityPerformance(
      requireCompanyId(req as AuthRequest),
      req.params.projectId
    );
    res.json({ status: 'success', data });
  })
);

router.get(
  '/delayed-projects',
  authorize({ resource: 'project', action: 'view' }),
  asyncHandler(async (req, res) => {
    const data = await contractingReportsService.getDelayedProjects(requireCompanyId(req as AuthRequest));
    res.json({ status: 'success', data });
  })
);

router.get(
  '/cost-overrun',
  authorize({ resource: 'project', action: 'view' }),
  asyncHandler(async (req, res) => {
    const data = await contractingReportsService.getCostOverrun(requireCompanyId(req as AuthRequest));
    res.json({ status: 'success', data: { items: data.items } });
  })
);

router.get(
  '/forecast-completion',
  authorize({ resource: 'project', action: 'view' }),
  validateQuery(reportQuerySchema.pick({ projectId: true })),
  asyncHandler(async (req, res) => {
    const q = req.query as { projectId?: string };
    const data = await contractingReportsService.getForecastCompletion(
      requireCompanyId(req as AuthRequest),
      q.projectId
    );
    res.json({ status: 'success', data });
  })
);

router.get(
  '/tender-pipeline',
  authorize({ resource: 'project', action: 'view' }),
  validateQuery(reportQuerySchema),
  asyncHandler(async (req, res) => {
    const data = await contractingReportsService.getTenderPipeline(
      requireCompanyId(req as AuthRequest),
      parseFilters(req.query as z.infer<typeof reportQuerySchema>)
    );
    res.json({ status: 'success', data });
  })
);

router.get(
  '/tender-win-loss',
  authorize({ resource: 'project', action: 'view' }),
  validateQuery(reportQuerySchema),
  asyncHandler(async (req, res) => {
    const data = await contractingReportsService.getTenderWinLoss(
      requireCompanyId(req as AuthRequest),
      parseFilters(req.query as z.infer<typeof reportQuerySchema>)
    );
    res.json({ status: 'success', data });
  })
);

router.get(
  '/tender-estimate-vs-actual',
  authorize({ resource: 'project', action: 'view' }),
  validateQuery(reportQuerySchema.pick({ projectId: true })),
  asyncHandler(async (req, res) => {
    const q = req.query as { projectId?: string };
    const data = await contractingReportsService.getTenderEstimateVsActual(
      requireCompanyId(req as AuthRequest),
      q.projectId
    );
    res.json({ status: 'success', data });
  })
);

router.get(
  '/margin-erosion',
  authorize({ resource: 'project', action: 'view' }),
  validateQuery(reportQuerySchema.pick({ projectId: true })),
  asyncHandler(async (req, res) => {
    const q = req.query as { projectId?: string };
    const data = await contractingReportsService.getMarginErosion(
      requireCompanyId(req as AuthRequest),
      q.projectId
    );
    res.json({ status: 'success', data });
  })
);

router.get(
  '/cash-vs-profit',
  authorize({ resource: 'project', action: 'view' }),
  validateQuery(reportQuerySchema.pick({ projectId: true })),
  asyncHandler(async (req, res) => {
    const q = req.query as { projectId?: string };
    const data = await contractingReportsService.getCashVsProfit(
      requireCompanyId(req as AuthRequest),
      q.projectId
    );
    res.json({ status: 'success', data });
  })
);

export default router;
