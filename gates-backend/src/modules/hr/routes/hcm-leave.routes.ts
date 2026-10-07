import { Router, Response } from 'express';
import { Decimal } from '@prisma/client/runtime/library';
import { authenticate } from '../../../shared/middleware/auth.middleware';
import { setTenantContext } from '../../../shared/middleware/tenant.middleware';
import type { AuthRequest } from '../../../shared/auth/types';
import prisma from '../../../shared/database/prisma';
import { authorizeLeave } from '../middleware/leave-authorize.middleware';
import { leaveBalanceService } from '../services/leave/leave-balance.service';
import { leaveLedgerService } from '../services/leave/leave-ledger.service';
import { leaveRequestService } from '../services/leave/leave-request.service';
import { leaveRequestCalculationService } from '../services/leave/leave-request-calculation.service';
import { leaveEnrollmentService } from '../services/leave/leave-enrollment.service';
import { leaveAccrualService } from '../services/leave/leave-accrual.service';
import { leaveEntitlementService } from '../services/leave/leave-entitlement.service';
import { hcmLeaveSetupService } from '../services/leave/hcm-leave-setup.service';
import { leaveExpiryService } from '../services/leave/leave-expiry.service';
import { leaveTerminationService } from '../services/leave/leave-termination.service';
import { leaveInboxService } from '../services/leave/leave-inbox.service';
import { leaveReportsService } from '../services/leave/leave-reports.service';
import { leaveEncashmentService } from '../services/leave/leave-encashment.service';
import { enqueueLeaveAccrual, runLeaveAccrualSync } from '../services/leave/hcm-leave-job.service';
import { hcmLeaveScheduleService } from '../services/leave/hcm-leave-schedule.service';
import { DEFAULT_LEAVE_POLICY } from '../services/leave/leave-policy.domain';

const router = Router();
router.use(authenticate);
router.use(setTenantContext);

function companyId(req: AuthRequest): string {
  const id = req.companyId ?? req.tenantId;
  if (!id) throw new Error('company required');
  return id;
}

router.get('/dashboard', authorizeLeave('view'), async (req: AuthRequest, res: Response) => {
  const cid = companyId(req);
  const today = new Date().toISOString().slice(0, 10);
  const onLeave = await prisma.hcmLeaveRequestDay.count({
    where: {
      companyId: cid,
      workDate: new Date(`${today}T00:00:00.000Z`),
      request: { status: 'APPROVED' },
    },
  });
  const pending = await prisma.hcmLeaveRequest.count({
    where: { companyId: cid, status: 'SUBMITTED' },
  });
  return void res.json({
    status: 'success',
    data: { onLeaveToday: onLeave, pendingRequests: pending },
  });
});

router.get('/types', authorizeLeave('view'), async (req: AuthRequest, res: Response) => {
  const cid = companyId(req);
  const rows = await prisma.hcmLeaveType.findMany({
    where: { companyId: cid, isActive: true },
    orderBy: { displayOrder: 'asc' },
  });
  return void res.json({ status: 'success', data: rows });
});

router.post('/types', authorizeLeave('policy_manage'), async (req: AuthRequest, res: Response) => {
  const cid = companyId(req);
  const body = req.body as Record<string, unknown>;
  const row = await prisma.hcmLeaveType.create({
    data: {
      companyId: cid,
      code: String(body.code),
      arabicName: String(body.arabicName),
      englishName: body.englishName ? String(body.englishName) : null,
      paidClassification: String(body.paidClassification ?? 'PAID'),
      requiresBalance: Boolean(body.requiresBalance ?? true),
      requiresAttachment: Boolean(body.requiresAttachment ?? false),
      attendanceClassification: String(body.attendanceClassification ?? 'PAID_LEAVE'),
      payrollClassification: body.payrollClassification ? String(body.payrollClassification) : null,
      displayOrder: Number(body.displayOrder ?? 0),
    },
  });
  return void res.json({ status: 'success', data: row });
});

router.get('/policies', authorizeLeave('view'), async (req: AuthRequest, res: Response) => {
  const cid = companyId(req);
  const rows = await prisma.hcmLeavePolicy.findMany({
    where: { companyId: cid, isActive: true },
    orderBy: { effectiveFrom: 'desc' },
  });
  return void res.json({ status: 'success', data: rows });
});

router.post('/policies', authorizeLeave('policy_manage'), async (req: AuthRequest, res: Response) => {
  const cid = companyId(req);
  const body = req.body as Record<string, unknown>;
  const row = await prisma.hcmLeavePolicy.create({
    data: {
      companyId: cid,
      code: String(body.code),
      arabicName: String(body.arabicName),
      effectiveFrom: new Date(String(body.effectiveFrom)),
      effectiveTo: body.effectiveTo ? new Date(String(body.effectiveTo)) : null,
      rules: (body.rules as object) ?? DEFAULT_LEAVE_POLICY,
    },
  });
  return void res.json({ status: 'success', data: row });
});

router.post('/enrollments', authorizeLeave('manage'), async (req: AuthRequest, res: Response) => {
  const cid = companyId(req);
  const body = req.body as Record<string, unknown>;
  const row = await leaveEnrollmentService.assignEnrollment(cid, {
    employmentId: String(body.employmentId),
    policyId: String(body.policyId),
    effectiveFrom: new Date(String(body.effectiveFrom)),
    effectiveTo: body.effectiveTo ? new Date(String(body.effectiveTo)) : null,
  });
  return void res.json({ status: 'success', data: row });
});

router.get('/balance/:employmentId/:leaveTypeId', authorizeLeave('view'), async (req: AuthRequest, res: Response) => {
  const cid = companyId(req);
  const asOf = (req.query.asOf as string) || new Date().toISOString().slice(0, 10);
  const data = await leaveBalanceService.getLeaveBalance(
    cid,
    req.params.employmentId,
    req.params.leaveTypeId,
    new Date(`${asOf}T00:00:00.000Z`)
  );
  return void res.json({ status: 'success', data });
});

router.get('/ledger/:employmentId', authorizeLeave('ledger_view'), async (req: AuthRequest, res: Response) => {
  const cid = companyId(req);
  const leaveTypeId = req.query.leaveTypeId as string;
  const asOf = (req.query.asOf as string) || new Date().toISOString().slice(0, 10);
  const entries = leaveTypeId
    ? await leaveLedgerService.listEntries(
        cid,
        req.params.employmentId,
        leaveTypeId,
        new Date(`${asOf}T00:00:00.000Z`)
      )
    : await prisma.hcmLeaveLedgerEntry.findMany({
        where: { companyId: cid, employmentId: req.params.employmentId },
        orderBy: [{ effectiveDate: 'desc' }, { createdAt: 'desc' }],
        take: 200,
      });
  return void res.json({ status: 'success', data: entries });
});

router.post('/adjustments', authorizeLeave('adjust'), async (req: AuthRequest, res: Response) => {
  const cid = companyId(req);
  const body = req.body as Record<string, unknown>;
  const credit = Boolean(body.credit);
  const qty = new Decimal(String(body.quantity));
  const employmentId = String(body.employmentId);
  const leaveTypeId = String(body.leaveTypeId);
  const effectiveDate = new Date(String(body.effectiveDate));
  const sourceKey = `adjust:${employmentId}:${leaveTypeId}:${Date.now()}`;
  const entry = await leaveLedgerService.postEntry({
    companyId: cid,
    employmentId,
    leaveTypeId,
    effectiveDate,
    quantity: qty,
    transactionType: credit ? 'ADJUSTMENT_CREDIT' : 'ADJUSTMENT_DEBIT',
    sourceKey,
    reason: body.reason ? String(body.reason) : undefined,
    createdBy: req.user?.sub,
  });
  return void res.json({ status: 'success', data: entry });
});

router.post('/requests/preview', authorizeLeave('request'), async (req: AuthRequest, res: Response) => {
  const cid = companyId(req);
  const body = req.body as Record<string, unknown>;
  const preview = await leaveRequestCalculationService.preview(
    cid,
    String(body.employmentId),
    String(body.leaveTypeId),
    new Date(String(body.startDate)),
    new Date(String(body.endDate)),
    {
      segmentType: body.segmentType as 'FULL' | 'HALF_AM' | 'HALF_PM' | 'HOURLY' | undefined,
      hourlyStart: body.hourlyStart ? new Date(String(body.hourlyStart)) : undefined,
      hourlyEnd: body.hourlyEnd ? new Date(String(body.hourlyEnd)) : undefined,
      timezone: body.timezone ? String(body.timezone) : undefined,
    }
  );
  const bal = await leaveBalanceService.getLeaveBalance(
    cid,
    String(body.employmentId),
    String(body.leaveTypeId),
    new Date(String(body.startDate))
  );
  return void res.json({ status: 'success', data: { preview, balance: bal } });
});

router.post('/requests', authorizeLeave('request'), async (req: AuthRequest, res: Response) => {
  const cid = companyId(req);
  const body = req.body as Record<string, unknown>;
  const row = await leaveRequestService.createDraft(cid, {
    employmentId: String(body.employmentId),
    employeeId: String(body.employeeId),
    leaveTypeId: String(body.leaveTypeId),
    startDate: new Date(String(body.startDate)),
    endDate: new Date(String(body.endDate)),
    reason: body.reason ? String(body.reason) : undefined,
    segmentType: body.segmentType as 'FULL' | 'HALF_AM' | 'HALF_PM' | 'HOURLY' | undefined,
    timezone: body.timezone ? String(body.timezone) : undefined,
  });
  return void res.json({ status: 'success', data: row });
});

router.post('/requests/:id/submit', authorizeLeave('request'), async (req: AuthRequest, res: Response) => {
  const cid = companyId(req);
  const row = await leaveRequestService.submit(cid, req.params.id, req.user!.sub!);
  return void res.json({ status: 'success', data: row });
});

router.post('/requests/:id/approve', authorizeLeave('approve'), async (req: AuthRequest, res: Response) => {
  const cid = companyId(req);
  const row = await leaveRequestService.approve(cid, req.params.id, req.user!.sub!);
  return void res.json({ status: 'success', data: row });
});

router.post('/requests/:id/reject', authorizeLeave('approve'), async (req: AuthRequest, res: Response) => {
  const cid = companyId(req);
  const body = req.body as { reason?: string };
  const row = await leaveRequestService.reject(cid, req.params.id, req.user!.sub!, body.reason);
  return void res.json({ status: 'success', data: row });
});

router.post('/requests/:id/cancel', authorizeLeave('manage'), async (req: AuthRequest, res: Response) => {
  const cid = companyId(req);
  const data = await leaveRequestService.cancelApproved(cid, req.params.id, req.user!.sub!);
  return void res.json({ status: 'success', data });
});

router.get('/requests', authorizeLeave('view'), async (req: AuthRequest, res: Response) => {
  const cid = companyId(req);
  const status = req.query.status as string | undefined;
  const rows = await prisma.hcmLeaveRequest.findMany({
    where: { companyId: cid, ...(status ? { status } : {}) },
    orderBy: { createdAt: 'desc' },
    take: 100,
    include: { leaveType: true, employee: { select: { id: true, arabicName: true } } },
  });
  return void res.json({ status: 'success', data: rows });
});

router.get('/calendar', authorizeLeave('view'), async (req: AuthRequest, res: Response) => {
  const cid = companyId(req);
  const from = (req.query.from as string) || new Date().toISOString().slice(0, 10);
  const to = (req.query.to as string) || from;
  const days = await prisma.hcmLeaveRequestDay.findMany({
    where: {
      companyId: cid,
      workDate: { gte: new Date(`${from}T00:00:00.000Z`), lte: new Date(`${to}T00:00:00.000Z`) },
      request: { status: { in: ['APPROVED', 'SUBMITTED'] } },
    },
    include: {
      request: {
        include: {
          leaveType: { select: { code: true, arabicName: true } },
          employee: { select: { id: true, arabicName: true } },
        },
      },
    },
  });
  return void res.json({ status: 'success', data: days });
});

router.get('/requests/inbox', authorizeLeave('approve'), async (req: AuthRequest, res: Response) => {
  const cid = companyId(req);
  const status = (req.query.status as string) || 'SUBMITTED';
  const data = await leaveInboxService.listInbox(cid, status);
  return void res.json({ status: 'success', data });
});

router.get('/enrollments', authorizeLeave('view'), async (req: AuthRequest, res: Response) => {
  const cid = companyId(req);
  const employmentId = req.query.employmentId as string | undefined;
  const rows = await prisma.hcmLeaveEnrollment.findMany({
    where: { companyId: cid, ...(employmentId ? { employmentId } : {}) },
    orderBy: { effectiveFrom: 'desc' },
    take: 200,
    include: {
      policy: { select: { id: true, code: true, arabicName: true, effectiveFrom: true, effectiveTo: true } },
      employment: { select: { id: true, episodeNumber: true, employee: { select: { arabicName: true } } } },
    },
  });
  return void res.json({ status: 'success', data: rows });
});

router.get('/meta/active-employments', authorizeLeave('view'), async (req: AuthRequest, res: Response) => {
  const cid = companyId(req);
  const rows = await prisma.hcmEmployment.findMany({
    where: { companyId: cid, status: 'ACTIVE' },
    select: {
      id: true,
      episodeNumber: true,
      employeeId: true,
      employee: { select: { arabicName: true, serial: true } },
    },
    take: 500,
  });
  return void res.json({
    status: 'success',
    data: rows.map((r) => ({
      employmentId: r.id,
      employeeId: r.employeeId,
      episodeNumber: r.episodeNumber,
      label: `${r.employee.arabicName}${r.employee.serial ? ` (${r.employee.serial})` : ''} — حلقة ${r.episodeNumber}`,
    })),
  });
});

router.post('/accrual/run', authorizeLeave('manage'), async (req: AuthRequest, res: Response) => {
  const cid = companyId(req);
  const body = req.body as { year?: number; month?: number; sync?: boolean };
  const now = new Date();
  const year = body.year ?? now.getUTCFullYear();
  const month = body.month ?? now.getUTCMonth() + 1;
  const result = body.sync
    ? await runLeaveAccrualSync(cid, year, month)
    : await enqueueLeaveAccrual(cid, year, month, req.user?.sub);
  return void res.json({ status: 'success', data: result });
});

router.get('/accrual/runs', authorizeLeave('manage'), async (req: AuthRequest, res: Response) => {
  const cid = companyId(req);
  const rows = await prisma.hcmLeaveAccrualRun.findMany({
    where: { companyId: cid },
    orderBy: { createdAt: 'desc' },
    take: 50,
  });
  return void res.json({ status: 'success', data: rows });
});

router.post('/accrual/schedule-due', authorizeLeave('manage'), async (req: AuthRequest, res: Response) => {
  const data = await hcmLeaveScheduleService.enqueueDueMonthlyAccrual();
  return void res.json({ status: 'success', data });
});

router.post('/encashment', authorizeLeave('adjust'), async (req: AuthRequest, res: Response) => {
  const cid = companyId(req);
  const body = req.body as Record<string, unknown>;
  const entry = await leaveEncashmentService.encash(cid, {
    employmentId: String(body.employmentId),
    leaveTypeId: String(body.leaveTypeId),
    quantity: String(body.quantity),
    effectiveDate: new Date(String(body.effectiveDate)),
    reason: body.reason ? String(body.reason) : undefined,
    createdBy: req.user?.sub,
  });
  return void res.json({ status: 'success', data: entry });
});

router.post('/encashment/:ledgerEntryId/reverse', authorizeLeave('adjust'), async (req: AuthRequest, res: Response) => {
  const cid = companyId(req);
  const entry = await leaveEncashmentService.reverse(cid, req.params.ledgerEntryId, req.user?.sub);
  return void res.json({ status: 'success', data: entry });
});

router.post('/entitlement/grant', authorizeLeave('manage'), async (req: AuthRequest, res: Response) => {
  const cid = companyId(req);
  const body = req.body as { employmentId: string; leaveTypeId: string; year: number };
  const result = await leaveEntitlementService.grantAnnualEntitlement(
    cid,
    body.employmentId,
    body.leaveTypeId,
    body.year,
    req.user?.sub
  );
  return void res.json({ status: 'success', data: result });
});

router.post('/bootstrap/company', authorizeLeave('manage'), async (req: AuthRequest, res: Response) => {
  const cid = companyId(req);
  const data = await hcmLeaveSetupService.ensureDefaultCatalog(cid);
  return void res.json({ status: 'success', data });
});

router.post('/cycle/carry-forward', authorizeLeave('manage'), async (req: AuthRequest, res: Response) => {
  const cid = companyId(req);
  const body = req.body as { employmentId: string; leaveTypeId: string; cycleEnd: string };
  const result = await leaveAccrualService.runCarryForward(
    cid,
    body.employmentId,
    body.leaveTypeId,
    new Date(body.cycleEnd)
  );
  return void res.json({ status: 'success', data: result });
});

router.post('/cycle/expire', authorizeLeave('manage'), async (req: AuthRequest, res: Response) => {
  const cid = companyId(req);
  const body = req.body as { employmentId: string; leaveTypeId: string; asOf: string };
  const result = await leaveExpiryService.runCarryExpiry(
    cid,
    body.employmentId,
    body.leaveTypeId,
    new Date(body.asOf)
  );
  return void res.json({ status: 'success', data: result });
});

router.get('/reports/balances', authorizeLeave('view'), async (req: AuthRequest, res: Response) => {
  const cid = companyId(req);
  const asOf = (req.query.asOf as string) || new Date().toISOString().slice(0, 10);
  const data = await leaveReportsService.balanceReport(cid, {
    asOf: new Date(`${asOf}T00:00:00.000Z`),
    employmentId: req.query.employmentId as string | undefined,
    leaveTypeId: req.query.leaveTypeId as string | undefined,
    branchId: req.query.branchId as string | undefined,
    departmentId: req.query.departmentId as string | undefined,
  });
  return void res.json({ status: 'success', data });
});

router.get('/reports/transactions', authorizeLeave('ledger_view'), async (req: AuthRequest, res: Response) => {
  const cid = companyId(req);
  const data = await leaveReportsService.transactionsReport(cid, {
    from: req.query.from ? new Date(`${req.query.from as string}T00:00:00.000Z`) : undefined,
    to: req.query.to ? new Date(`${req.query.to as string}T00:00:00.000Z`) : undefined,
    employmentId: req.query.employmentId as string | undefined,
    leaveTypeId: req.query.leaveTypeId as string | undefined,
  });
  return void res.json({ status: 'success', data });
});

router.get('/reports/taken', authorizeLeave('view'), async (req: AuthRequest, res: Response) => {
  const cid = companyId(req);
  const data = await leaveReportsService.takenReport(cid, {
    from: req.query.from ? new Date(`${req.query.from as string}T00:00:00.000Z`) : undefined,
    to: req.query.to ? new Date(`${req.query.to as string}T00:00:00.000Z`) : undefined,
    employmentId: req.query.employmentId as string | undefined,
    leaveTypeId: req.query.leaveTypeId as string | undefined,
  });
  return void res.json({ status: 'success', data });
});

router.get('/reports/pending', authorizeLeave('view'), async (req: AuthRequest, res: Response) => {
  const cid = companyId(req);
  const data = await leaveReportsService.pendingRequestsReport(cid, {
    status: (req.query.status as string) || 'SUBMITTED',
    employmentId: req.query.employmentId as string | undefined,
  });
  return void res.json({ status: 'success', data });
});

router.get('/reports/expiring', authorizeLeave('view'), async (req: AuthRequest, res: Response) => {
  const cid = companyId(req);
  const asOf = (req.query.asOf as string) || new Date().toISOString().slice(0, 10);
  const data = await leaveReportsService.expiringLeaveReport(cid, new Date(`${asOf}T00:00:00.000Z`));
  return void res.json({ status: 'success', data });
});

router.get('/reports/liability-facts', authorizeLeave('view'), async (req: AuthRequest, res: Response) => {
  const cid = companyId(req);
  const asOf = (req.query.asOf as string) || new Date().toISOString().slice(0, 10);
  const data = await leaveReportsService.liabilityFactsReport(cid, new Date(`${asOf}T00:00:00.000Z`));
  return void res.json({ status: 'success', data });
});

router.get('/reports/absence-summary', authorizeLeave('view'), async (req: AuthRequest, res: Response) => {
  const cid = companyId(req);
  const from = (req.query.from as string) || new Date().toISOString().slice(0, 10);
  const to = (req.query.to as string) || from;
  const data = await leaveReportsService.absenceLeaveSummary(
    cid,
    new Date(`${from}T00:00:00.000Z`),
    new Date(`${to}T00:00:00.000Z`),
    req.query.employmentId as string | undefined
  );
  return void res.json({ status: 'success', data });
});

router.get('/employment/:employmentId/settlement', authorizeLeave('view'), async (req: AuthRequest, res: Response) => {
  const cid = companyId(req);
  const asOf = req.query.asOf as string | undefined;
  const data = await leaveTerminationService.settlementFacts(
    cid,
    req.params.employmentId,
    asOf ? new Date(`${asOf}T00:00:00.000Z`) : undefined
  );
  return void res.json({ status: 'success', data });
});

export default router;
