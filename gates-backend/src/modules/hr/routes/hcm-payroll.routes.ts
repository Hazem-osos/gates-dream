import { Router, Response } from 'express';
import { authenticate } from '../../../shared/middleware/auth.middleware';
import { authorize } from '../../../shared/middleware/authorize.middleware';
import { setTenantContext } from '../../../shared/middleware/tenant.middleware';
import { AppError } from '../../../shared/middleware/error-handler';
import type { AuthRequest } from '../../../shared/auth/types';
import prisma from '../../../shared/database/prisma';
import { payrollRunCalculationService } from '../services/payroll/payroll-run-calculation.service';
import { payrollRuleEngineService } from '../services/payroll/payroll-rule-engine.service';
import { payrollContextBuilderService } from '../services/payroll/payroll-context-builder.service';
import { evaluatePayrollExpression } from '../services/payroll/payroll-expression.evaluator';
import { payrollDashboardService } from '../services/payroll/payroll-dashboard.service';
import { payrollReportsService } from '../services/payroll/payroll-reports.service';
import { payrollEngineModeService } from '../services/payroll/payroll-engine-mode.service';
import { payrollGlMappingService } from '../services/payroll/payroll-gl-mapping.service';
import { payrollRunReadService } from '../services/payroll/payroll-run-read.service';
import { canViewPayrollAmounts, canManagePayrollRules } from '../services/payroll/payroll-permission.util';
import { PAYROLL_RULE_VARIABLE_CATALOG } from '../services/payroll/payroll-variable-catalog';
import { orderPayrollRules } from '../services/payroll/payroll-rule-graph.domain';
import { payrollPayComponentService } from '../services/payroll/payroll-pay-component.service';
import { payrollCompensationComponentService } from '../services/payroll/payroll-compensation-component.service';
import { payrollRuleAdminService } from '../services/payroll/payroll-rule-admin.service';
import { payrollLocalizationAdminService } from '../services/payroll/payroll-localization-admin.service';

const router = Router();

router.use(authenticate);
router.use(setTenantContext);

function companyId(req: AuthRequest) {
  const id = req.companyId ?? req.tenantId;
  if (!id) throw new AppError(400, 'معرّف الشركة مطلوب');
  return id;
}

router.get(
  '/components',
  authorize({ resource: 'payroll', action: 'view' }),
  async (req: AuthRequest, res: Response) => {
    const rows = await prisma.hcmPayComponent.findMany({
      where: { companyId: companyId(req) },
      orderBy: [{ priority: 'asc' }, { code: 'asc' }],
    });
    res.json({ status: 'success', data: rows });
  }
);

router.patch(
  '/components/:id/gl',
  authorize({ resource: 'payroll', action: 'gl_manage' }),
  async (req: AuthRequest, res: Response) => {
    const companyIdVal = companyId(req);
    const body = req.body as { glExpenseAccountId?: string; glPayableAccountId?: string };
    const data = await payrollGlMappingService.updateComponentGlAccounts(companyIdVal, req.params.id, {
      glExpenseAccountId: body.glExpenseAccountId ?? undefined,
      glPayableAccountId: body.glPayableAccountId ?? undefined,
    });
    res.json({ status: 'success', data });
  }
);

router.post(
  '/components',
  authorize({ resource: 'payroll', action: 'edit' }),
  async (req: AuthRequest, res: Response) => {
    const companyIdVal = companyId(req);
    const body = req.body as Record<string, unknown>;
    const row = await payrollPayComponentService.createComponent(companyIdVal, {
      code: String(body.code ?? ''),
      arabicName: String(body.arabicName ?? body.code),
      englishName: body.englishName ? String(body.englishName) : null,
      componentType: String(body.componentType ?? 'EARNING'),
      taxableClass: body.taxableClass ? String(body.taxableClass) : undefined,
      insurableClass: body.insurableClass ? String(body.insurableClass) : undefined,
      priority: body.priority != null ? Number(body.priority) : undefined,
      isRecurring: body.isRecurring !== false,
      showOnPayslip: body.showOnPayslip !== false,
    });
    res.status(201).json({ status: 'success', data: row });
  }
);

router.patch(
  '/components/:id',
  authorize({ resource: 'payroll', action: 'edit' }),
  async (req: AuthRequest, res: Response) => {
    const body = req.body as Record<string, unknown>;
    const row = await payrollPayComponentService.updateComponent(companyId(req), req.params.id, {
      arabicName: body.arabicName ? String(body.arabicName) : undefined,
      englishName: body.englishName !== undefined ? (body.englishName ? String(body.englishName) : null) : undefined,
      taxableClass: body.taxableClass ? String(body.taxableClass) : undefined,
      insurableClass: body.insurableClass ? String(body.insurableClass) : undefined,
      isRecurring: body.isRecurring !== undefined ? Boolean(body.isRecurring) : undefined,
      showOnPayslip: body.showOnPayslip !== undefined ? Boolean(body.showOnPayslip) : undefined,
      priority: body.priority != null ? Number(body.priority) : undefined,
      isActive: body.isActive !== undefined ? Boolean(body.isActive) : undefined,
    });
    res.json({ status: 'success', data: row });
  }
);

router.get(
  '/rules',
  authorize({ resource: 'payroll', action: 'view' }),
  async (req: AuthRequest, res: Response) => {
    const rows = await prisma.hcmPayrollRule.findMany({
      where: { companyId: companyId(req) },
      include: { payComponent: { select: { code: true, componentType: true } } },
      orderBy: [{ phase: 'asc' }, { priority: 'asc' }],
    });
    res.json({ status: 'success', data: rows });
  }
);

router.get('/rules/variable-catalog', authorize({ resource: 'payroll', action: 'view' }), (_req, res) => {
  res.json({ status: 'success', data: PAYROLL_RULE_VARIABLE_CATALOG });
});

router.post(
  '/rules/validate',
  authorize({ resource: 'payroll', action: 'rules_manage' }),
  async (req: AuthRequest, res: Response) => {
    const companyIdVal = companyId(req);
    const body = req.body as Record<string, unknown>;
    const result = await payrollRuleAdminService.validateAndCheckGraph(companyIdVal, {
      code: String(body.code ?? ''),
      payComponentId: String(body.payComponentId ?? ''),
      formulaExpr: String(body.formulaExpr ?? ''),
      conditionExpr: body.conditionExpr ? String(body.conditionExpr) : null,
      dependsOnCodes: Array.isArray(body.dependsOnCodes) ? (body.dependsOnCodes as string[]) : [],
      phase: Number(body.phase ?? 10),
      priority: Number(body.priority ?? 100),
    });
    res.json({ status: 'success', data: result });
  }
);

router.get(
  '/rules/:code/versions',
  authorize({ resource: 'payroll', action: 'view' }),
  async (req: AuthRequest, res: Response) => {
    const rows = await payrollRuleAdminService.listVersions(companyId(req), req.params.code);
    res.json({ status: 'success', data: rows });
  }
);

router.patch(
  '/rules/:id',
  authorize({ resource: 'payroll', action: 'rules_manage' }),
  async (req: AuthRequest, res: Response) => {
    const companyIdVal = companyId(req);
    if (!(await canManagePayrollRules(req, companyIdVal))) {
      throw new AppError(403, 'Payroll rules manage permission required');
    }
    const body = req.body as Record<string, unknown>;
    const row = await payrollRuleAdminService.updateRule(companyIdVal, req.params.id, {
      name: body.name ? String(body.name) : undefined,
      phase: body.phase != null ? Number(body.phase) : undefined,
      priority: body.priority != null ? Number(body.priority) : undefined,
      effectiveFrom: body.effectiveFrom ? new Date(String(body.effectiveFrom)) : undefined,
      effectiveTo: body.effectiveTo ? new Date(String(body.effectiveTo)) : body.effectiveTo === null ? null : undefined,
      conditionExpr: body.conditionExpr !== undefined ? (body.conditionExpr ? String(body.conditionExpr) : null) : undefined,
      formulaExpr: body.formulaExpr ? String(body.formulaExpr) : undefined,
      dependsOnCodes: Array.isArray(body.dependsOnCodes) ? (body.dependsOnCodes as string[]) : undefined,
      isActive: body.isActive !== undefined ? Boolean(body.isActive) : undefined,
    });
    res.json({ status: 'success', data: row });
  }
);

router.post(
  '/rules',
  authorize({ resource: 'payroll', action: 'rules_manage' }),
  async (req: AuthRequest, res: Response) => {
    const companyIdVal = companyId(req);
    if (!(await canManagePayrollRules(req, companyIdVal))) {
      throw new AppError(403, 'Payroll rules manage permission required');
    }
    const body = req.body as Record<string, unknown>;
    const payComponentId = String(body.payComponentId ?? '');
    const formulaExpr = String(body.formulaExpr ?? '');
    evaluatePayrollExpression(formulaExpr, { comp_basic: 1, period_days: 30 });

    const row = await prisma.hcmPayrollRule.create({
      data: {
        companyId: companyIdVal,
        payComponentId,
        code: String(body.code ?? ''),
        name: String(body.name ?? body.code),
        phase: Number(body.phase ?? 10),
        priority: Number(body.priority ?? 100),
        effectiveFrom: new Date(String(body.effectiveFrom)),
        effectiveTo: body.effectiveTo ? new Date(String(body.effectiveTo)) : null,
        conditionExpr: body.conditionExpr ? String(body.conditionExpr) : null,
        formulaExpr,
        dependsOnCodes: body.dependsOnCodes ? JSON.stringify(body.dependsOnCodes) : null,
        localizationKey: body.localizationKey ? String(body.localizationKey) : null,
      },
    });
    const allRules = await prisma.hcmPayrollRule.findMany({
      where: { companyId: companyIdVal },
      include: { payComponent: { select: { code: true } } },
    });
    orderPayrollRules(
      allRules.map((r) => ({
        code: r.code,
        componentCode: r.payComponent.code,
        phase: r.phase,
        priority: r.priority,
        dependsOn: r.dependsOnCodes ? (JSON.parse(r.dependsOnCodes) as string[]) : [],
      }))
    );
    res.status(201).json({ status: 'success', data: row });
  }
);

router.post(
  '/rules/simulate',
  authorize({ resource: 'payroll', action: 'view' }),
  async (req: AuthRequest, res: Response) => {
    const companyIdVal = companyId(req);
    const { employeeId, periodYear, periodMonth, formulaExpr, conditionExpr } = req.body as {
      employeeId: string;
      periodYear: number;
      periodMonth: number;
      formulaExpr: string;
      conditionExpr?: string;
    };
    const ctx = await payrollContextBuilderService.buildEmployeeContext(
      companyIdVal,
      employeeId,
      Number(periodYear),
      Number(periodMonth)
    );
    const result = payrollRuleEngineService.simulateRule(
      formulaExpr,
      conditionExpr ?? null,
      ctx
    );
    res.json({ status: 'success', data: { ...result, contextSample: ctx.vars } });
  }
);

router.get(
  '/dashboard/metrics',
  authorize({ resource: 'payroll', action: 'view' }),
  async (req: AuthRequest, res: Response) => {
    const cid = companyId(req);
    const periodYear = Number(req.query.periodYear ?? new Date().getUTCFullYear());
    const periodMonth = Number(req.query.periodMonth ?? new Date().getUTCMonth() + 1);
    const includeAmounts = await canViewPayrollAmounts(req, cid);
    const data = await payrollDashboardService.getMetrics(cid, periodYear, periodMonth);
    if (!includeAmounts) {
      return void res.json({
        status: 'success',
        data: {
          ...data,
          gross: null,
          net: null,
          deductions: null,
          employerContributions: null,
          unpostedPayroll: null,
          unpaidPayroll: null,
          amountsRedacted: true,
        },
      });
    }
    res.json({ status: 'success', data: { ...data, amountsRedacted: false } });
  }
);

router.get(
  '/runs/create-context',
  authorize({ resource: 'payroll', action: 'view' }),
  async (req: AuthRequest, res: Response) => {
    const cid = companyId(req);
    const periodYear = Number(req.query.periodYear ?? new Date().getUTCFullYear());
    const periodMonth = Number(req.query.periodMonth ?? new Date().getUTCMonth() + 1);
    const periodEnd = new Date(Date.UTC(periodYear, periodMonth, 0));
    const engineMode = await payrollEngineModeService.resolveForCalculation(cid, periodEnd);
    const configuredMode = await payrollEngineModeService.getConfiguredMode(cid);
    const employeeCount = await prisma.employee.count({
      where: { companyId: cid, isActive: true, basicSalary: { gt: 0 } },
    });
    const duplicate = await prisma.payrollRun.findFirst({
      where: { companyId: cid, periodYear, periodMonth, status: { notIn: ['CANCELLED', 'REVERSED'] } },
    });
    res.json({
      status: 'success',
      data: {
        periodYear,
        periodMonth,
        engineMode,
        configuredMode,
        employeeCount,
        duplicateRunId: duplicate?.id ?? null,
      },
    });
  }
);

router.get(
  '/engine-mode',
  authorize({ resource: 'payroll', action: 'view' }),
  async (req: AuthRequest, res: Response) => {
    const mode = await payrollEngineModeService.getConfiguredMode(companyId(req));
    res.json({ status: 'success', data: { payrollEngineMode: mode } });
  }
);

router.patch(
  '/engine-mode',
  authorize({ resource: 'payroll', action: 'edit' }),
  async (req: AuthRequest, res: Response) => {
    const mode = String((req.body as { payrollEngineMode?: string }).payrollEngineMode ?? '');
    if (!['RULE_ENGINE', 'LEGACY_COMPATIBILITY'].includes(mode)) {
      throw new AppError(400, 'Invalid payroll engine mode');
    }
    await prisma.hrSettings.update({
      where: { companyId: companyId(req) },
      data: { payrollEngineMode: mode },
    });
    res.json({ status: 'success', data: { payrollEngineMode: mode } });
  }
);

router.get(
  '/runs/:id/reports/register',
  authorize({ resource: 'payroll', action: 'view' }),
  async (req: AuthRequest, res: Response) => {
    const data = await payrollReportsService.payrollRegister(companyId(req), req.params.id);
    if (!data) throw new AppError(404, 'Run not found');
    res.json({ status: 'success', data });
  }
);

router.get(
  '/runs/:id/reports/component-summary',
  authorize({ resource: 'payroll', action: 'view' }),
  async (req: AuthRequest, res: Response) => {
    const data = await payrollReportsService.componentSummary(companyId(req), req.params.id);
    if (!data) throw new AppError(404, 'Run not found');
    res.json({ status: 'success', data });
  }
);

router.post(
  '/runs/preview',
  authorize({ resource: 'payroll', action: 'view' }),
  async (req: AuthRequest, res: Response) => {
    const cid = companyId(req);
    const { periodYear, periodMonth } = req.body as { periodYear: number; periodMonth: number };
    const data = await payrollRunCalculationService.previewRun(
      cid,
      Number(periodYear),
      Number(periodMonth)
    );
    const includeAmounts = await canViewPayrollAmounts(req, cid);
    if (!includeAmounts) {
      return void res.json({
        status: 'success',
        data: {
          ...data,
          totals: null,
          blockers: data.blockers.map((b) => ({ ...b, messages: b.messages })),
          amountsRedacted: true,
        },
      });
    }
    res.json({ status: 'success', data: { ...data, amountsRedacted: false } });
  }
);

router.get(
  '/runs',
  authorize({ resource: 'payroll', action: 'view' }),
  async (req: AuthRequest, res: Response) => {
    const cid = companyId(req);
    const includeAmounts = await canViewPayrollAmounts(req, cid);
    const data = await payrollRunReadService.listRuns(
      cid,
      {
        periodYear: req.query.periodYear ? Number(req.query.periodYear) : undefined,
        status: req.query.status as string | undefined,
        calculationMode: req.query.calculationMode as string | undefined,
        branchId: req.query.branchId as string | undefined,
        page: req.query.page ? Number(req.query.page) : 1,
        pageSize: req.query.pageSize ? Number(req.query.pageSize) : 25,
      },
      includeAmounts
    );
    res.json({ status: 'success', data });
  }
);

router.get(
  '/runs/:id/review',
  authorize({ resource: 'payroll', action: 'view' }),
  async (req: AuthRequest, res: Response) => {
    const cid = companyId(req);
    const includeAmounts = await canViewPayrollAmounts(req, cid);
    const data = await payrollRunReadService.getRunReview(cid, req.params.id, includeAmounts);
    res.json({ status: 'success', data });
  }
);

router.get('/gl-mappings', authorize({ resource: 'payroll', action: 'view' }), async (req, res) => {
  const cid = companyId(req as AuthRequest);
  const components = await prisma.hcmPayComponent.findMany({
    where: { companyId: cid },
    select: { id: true, code: true },
  });
  const idByCode = new Map(components.map((c) => [c.code, c.id]));
  const map = await payrollGlMappingService.resolveComponentMappings(cid);
  const rows = [...map.entries()].map(([code, m]) => ({
    componentId: idByCode.get(code) ?? null,
    code,
    componentType: m.componentType,
    expenseAccountId: m.expenseAccountId,
    payableAccountId: m.payableAccountId,
    status:
      m.componentType === 'DEDUCTION'
        ? m.payableAccountId
          ? 'MAPPED'
          : 'MISSING'
        : m.expenseAccountId
          ? 'MAPPED'
          : 'MISSING',
  }));
  res.json({ status: 'success', data: rows });
});

router.get(
  '/inputs',
  authorize({ resource: 'payroll', action: 'inputs_manage' }),
  async (req: AuthRequest, res: Response) => {
    const rows = await prisma.hcmPayrollOneTimeInput.findMany({
      where: { companyId: companyId(req) },
      orderBy: { createdAt: 'desc' },
      take: 200,
      include: {
        employee: { select: { id: true, arabicName: true } },
        payComponent: { select: { code: true, arabicName: true } },
      },
    });
    res.json({ status: 'success', data: rows });
  }
);

router.post(
  '/inputs',
  authorize({ resource: 'payroll', action: 'inputs_manage' }),
  async (req: AuthRequest, res: Response) => {
    const cid = companyId(req);
    const body = req.body as Record<string, unknown>;
    const row = await prisma.hcmPayrollOneTimeInput.create({
      data: {
        companyId: cid,
        employmentId: String(body.employmentId),
        employeeId: String(body.employeeId),
        payComponentId: String(body.payComponentId),
        periodYear: Number(body.periodYear),
        periodMonth: Number(body.periodMonth),
        amount: Number(body.amount),
        reason: body.reason ? String(body.reason) : null,
        status: 'DRAFT',
      },
    });
    res.status(201).json({ status: 'success', data: row });
  }
);

router.post(
  '/inputs/bulk',
  authorize({ resource: 'payroll', action: 'inputs_manage' }),
  async (req: AuthRequest, res: Response) => {
    const cid = companyId(req);
    const rows = (req.body as { rows?: Array<Record<string, unknown>> }).rows ?? [];
    const results: Array<{ index: number; ok: boolean; id?: string; error?: string }> = [];
    for (let i = 0; i < rows.length; i++) {
      const body = rows[i];
      try {
        const emp = await prisma.employee.findFirst({
          where: { id: String(body.employeeId), companyId: cid },
          include: { hcmEmployments: { where: { status: 'ACTIVE' }, take: 1 } },
        });
        if (!emp?.hcmEmployments[0]) throw new AppError(422, 'Employee not found');
        const comp = await prisma.hcmPayComponent.findFirst({
          where: { id: String(body.payComponentId), companyId: cid, isActive: true },
        });
        if (!comp) throw new AppError(422, 'Invalid component');
        const row = await prisma.hcmPayrollOneTimeInput.create({
          data: {
            companyId: cid,
            employmentId: emp.hcmEmployments[0].id,
            employeeId: emp.id,
            payComponentId: comp.id,
            periodYear: Number(body.periodYear),
            periodMonth: Number(body.periodMonth),
            amount: Number(body.amount),
            reason: body.reason ? String(body.reason) : null,
            status: 'DRAFT',
          },
        });
        results.push({ index: i, ok: true, id: row.id });
      } catch (e) {
        results.push({
          index: i,
          ok: false,
          error: e instanceof AppError ? e.message : e instanceof Error ? e.message : 'Failed',
        });
      }
    }
    res.json({ status: 'success', data: { results } });
  }
);

router.patch(
  '/inputs/:id',
  authorize({ resource: 'payroll', action: 'inputs_manage' }),
  async (req: AuthRequest, res: Response) => {
    const cid = companyId(req);
    const body = req.body as Record<string, unknown>;
    const updated = await prisma.hcmPayrollOneTimeInput.updateMany({
      where: { id: req.params.id, companyId: cid, status: 'DRAFT' },
      data: {
        amount: body.amount != null ? Number(body.amount) : undefined,
        reason: body.reason !== undefined ? (body.reason ? String(body.reason) : null) : undefined,
        periodYear: body.periodYear != null ? Number(body.periodYear) : undefined,
        periodMonth: body.periodMonth != null ? Number(body.periodMonth) : undefined,
      },
    });
    if (updated.count !== 1) throw new AppError(404, 'Draft input not found');
    const row = await prisma.hcmPayrollOneTimeInput.findFirst({ where: { id: req.params.id, companyId: cid } });
    res.json({ status: 'success', data: row });
  }
);

router.post(
  '/inputs/:id/approve',
  authorize({ resource: 'payroll', action: 'inputs_manage' }),
  async (req: AuthRequest, res: Response) => {
    const cid = companyId(req);
    const row = await prisma.hcmPayrollOneTimeInput.updateMany({
      where: { id: req.params.id, companyId: cid, status: 'DRAFT' },
      data: {
        status: 'APPROVED',
        approvedById: req.user?.sub,
        approvedAt: new Date(),
      },
    });
    if (row.count !== 1) throw new AppError(404, 'Input not found or not approvable');
    const updated = await prisma.hcmPayrollOneTimeInput.findFirst({
      where: { id: req.params.id, companyId: cid },
    });
    res.json({ status: 'success', data: updated });
  }
);

const reportHandlers: Record<
  string,
  (cid: string, runId: string, query: Record<string, string | undefined>) => Promise<unknown>
> = {
  summary: (cid, runId) => payrollReportsService.payrollSummary(cid, runId),
  register: (cid, runId, query) =>
    payrollReportsService.payrollRegister(cid, runId, {
      page: query.page ? Number(query.page) : undefined,
      pageSize: query.pageSize ? Number(query.pageSize) : undefined,
    }),
  'component-summary': (cid, runId) => payrollReportsService.componentSummary(cid, runId),
  'deduction-summary': (cid, runId) => payrollReportsService.deductionSummary(cid, runId),
  overtime: (cid, runId) => payrollReportsService.overtimeReport(cid, runId),
  'absence-leave': (cid, runId) => payrollReportsService.absenceLeaveReport(cid, runId),
  'advance-recovery': (cid, runId) => payrollReportsService.advanceRecoveryReport(cid, runId),
  'employer-contributions': (cid, runId) =>
    payrollReportsService.employerContributionReport(cid, runId),
  'by-branch': (cid, runId) => payrollReportsService.byDimension(cid, runId, 'branch'),
  'by-department': (cid, runId) => payrollReportsService.byDimension(cid, runId, 'department'),
  'by-cost-center': (cid, runId) => payrollReportsService.byDimension(cid, runId, 'costCenter'),
  reconciliation: (cid, runId) => payrollReportsService.accountingReconciliation(cid, runId),
};

function reportToCsv(reportKey: string, data: unknown): string {
  if (reportKey === 'register' && data && typeof data === 'object' && 'rows' in data) {
    const d = data as { rows: Array<{ serial?: string; employeeName: string; grossSalary: number; netSalary: number }> };
    const lines = ['serial,employeeName,gross,net'];
    for (const r of d.rows) {
      lines.push(`${r.serial ?? ''},"${r.employeeName}",${r.grossSalary},${r.netSalary}`);
    }
    return lines.join('\n');
  }
  return JSON.stringify(data);
}

router.get(
  '/runs/:id/reports/:reportKey',
  authorize({ resource: 'payroll', action: 'view' }),
  async (req: AuthRequest, res: Response) => {
    const cid = companyId(req);
    if (!(await canViewPayrollAmounts(req, cid))) {
      throw new AppError(403, 'Payroll amounts permission required');
    }
    const handler = reportHandlers[req.params.reportKey];
    if (!handler) throw new AppError(404, 'Unknown report');
    const q = req.query as Record<string, string | undefined>;
    const data = await handler(cid, req.params.id, q);
    if (!data) throw new AppError(404, 'Run not found');
    if (req.query.format === 'csv') {
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.send(reportToCsv(req.params.reportKey, data));
      return;
    }
    res.json({ status: 'success', data });
  }
);

router.get(
  '/employment/:employmentId/compensation-components',
  authorize({ resource: 'payroll', action: 'view' }),
  async (req: AuthRequest, res: Response) => {
    const cid = companyId(req);
    const includeAmounts = await canViewPayrollAmounts(req, cid);
    const rows = await payrollCompensationComponentService.listForEmployment(cid, req.params.employmentId);
    if (!includeAmounts) {
      return void res.json({
        status: 'success',
        data: rows.map((r) => ({ ...r, amount: null, amountsRedacted: true })),
      });
    }
    res.json({ status: 'success', data: rows });
  }
);

router.post(
  '/employment/:employmentId/compensation-components',
  authorize({ resource: 'payroll', action: 'edit' }),
  async (req: AuthRequest, res: Response) => {
    const body = req.body as Record<string, unknown>;
    const row = await payrollCompensationComponentService.assignComponent(
      companyId(req),
      req.params.employmentId,
      {
        payComponentId: String(body.payComponentId),
        amount: Number(body.amount),
        effectiveFrom: new Date(String(body.effectiveFrom)),
        effectiveTo: body.effectiveTo ? new Date(String(body.effectiveTo)) : null,
        currencyCode: body.currencyCode ? String(body.currencyCode) : undefined,
      }
    );
    res.status(201).json({ status: 'success', data: row });
  }
);

router.post(
  '/employment/:employmentId/compensation-components/change',
  authorize({ resource: 'payroll', action: 'edit' }),
  async (req: AuthRequest, res: Response) => {
    const body = req.body as Record<string, unknown>;
    const row = await payrollCompensationComponentService.changeComponentAmount(
      companyId(req),
      req.params.employmentId,
      String(body.payComponentId),
      Number(body.amount),
      new Date(String(body.effectiveFrom))
    );
    res.json({ status: 'success', data: row });
  }
);

router.get(
  '/localization/schema/:countryCode',
  authorize({ resource: 'payroll', action: 'view' }),
  async (req: AuthRequest, res: Response) => {
    res.json({
      status: 'success',
      data: payrollLocalizationAdminService.providerSchema(req.params.countryCode),
    });
  }
);

router.post(
  '/localization',
  authorize({ resource: 'payroll', action: 'localization_manage' }),
  async (req: AuthRequest, res: Response) => {
    const body = req.body as Record<string, unknown>;
    const row = await payrollLocalizationAdminService.upsertConfig(companyId(req), {
      countryCode: String(body.countryCode ?? 'EG'),
      configKey: String(body.configKey ?? 'DEFAULT'),
      effectiveFrom: new Date(String(body.effectiveFrom)),
      effectiveTo: body.effectiveTo ? new Date(String(body.effectiveTo)) : null,
      config: (body.config as Record<string, unknown>) ?? {},
      isActive: body.isActive !== false,
    });
    res.status(201).json({ status: 'success', data: row });
  }
);

router.get(
  '/localization',
  authorize({ resource: 'payroll', action: 'view' }),
  async (req: AuthRequest, res: Response) => {
    const rows = await prisma.hcmPayrollLocalizationConfig.findMany({
      where: { companyId: companyId(req) },
      orderBy: [{ countryCode: 'asc' }, { effectiveFrom: 'desc' }],
    });
    res.json({ status: 'success', data: rows });
  }
);

router.get(
  '/runs/:id/payslip/:employeeId',
  authorize({ resource: 'payroll', action: 'view' }),
  async (req: AuthRequest, res: Response) => {
    const companyIdVal = companyId(req);
    const item = await prisma.payrollRunItem.findFirst({
      where: {
        payrollRunId: req.params.id,
        employeeId: req.params.employeeId,
        payrollRun: { companyId: companyIdVal },
      },
      include: {
        employee: { select: { id: true, arabicName: true, serial: true } },
        components: { orderBy: [{ phase: 'asc' }, { componentCode: 'asc' }] },
        payrollRun: { select: { periodMonth: true, periodYear: true, status: true } },
      },
    });
    if (!item) throw new AppError(404, 'Payslip not found');
    const includeAmounts = await canViewPayrollAmounts(req, companyIdVal);
    if (!includeAmounts) {
      return void res.json({
        status: 'success',
        data: {
          ...item,
          grossSalary: null,
          netSalary: null,
          basicSalary: null,
          components: [],
          amountsRedacted: true,
        },
      });
    }
    res.json({ status: 'success', data: { ...item, amountsRedacted: false } });
  }
);

export default router;
