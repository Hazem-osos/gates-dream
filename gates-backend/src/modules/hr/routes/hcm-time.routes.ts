import { Router, Response } from 'express';
import { authenticate } from '../../../shared/middleware/auth.middleware';
import { setTenantContext } from '../../../shared/middleware/tenant.middleware';
import type { AuthRequest } from '../../../shared/auth/types';
import prisma from '../../../shared/database/prisma';
import { authorizeAttendance } from '../middleware/attendance-authorize.middleware';
import { punchIngestionService } from '../services/time/punch-ingestion.service';
import { attendanceCalculationService } from '../services/time/attendance-calculation.service';
import { timeCorrectionService } from '../services/time/time-correction.service';
import { timePeriodReviewService } from '../services/time/time-period-review.service';
import { timePayrollReadService } from '../services/time/time-payroll-read.service';
import { todayAttendanceService } from '../services/time/today-attendance.service';
import { csvPunchImportService } from '../services/time/csv-punch-import.service';
import { enqueueHcmTimeRecalc } from '../services/time/hcm-time-job.service';
import { scheduleAssignmentService } from '../services/time/schedule-assignment.service';
const router = Router();
router.use(authenticate);
router.use(setTenantContext);

function getCompanyId(req: AuthRequest): string | undefined {
  return req.companyId ?? req.tenantId;
}

function stripDeviceSecrets<T extends { config?: unknown }>(device: T) {
  const { config: _c, ...rest } = device;
  return { ...rest, hasConfig: Boolean(_c) };
}

router.get('/dashboard', authorizeAttendance('view'), async (req: AuthRequest, res: Response) => {
  const companyId = getCompanyId(req);
  if (!companyId) return void res.status(400).json({ status: 'error', message: 'معرّف الشركة مطلوب' });
  const date = (req.query.date as string) || new Date().toISOString().slice(0, 10);
  const dayStart = new Date(`${date}T00:00:00.000Z`);
  const tz = (req.query.timezone as string) || 'UTC';
  const today = await todayAttendanceService.list(companyId, dayStart, undefined, tz);
  const days = await prisma.hcmAttendanceDay.findMany({
    where: { companyId, logicalWorkDate: dayStart },
    select: { detectedOvertimeMinutes: true, approvedOvertimeMinutes: true },
  });
  const otPending = days.filter((d) => d.detectedOvertimeMinutes > d.approvedOvertimeMinutes).length;
  const [exceptions, unmatched] = await Promise.all([
    prisma.hcmTimeException.count({ where: { companyId, status: 'OPEN' } }),
    prisma.hcmTimeException.count({
      where: { companyId, exceptionType: 'UNMATCHED_PUNCH', status: 'OPEN' },
    }),
  ]);
  const metrics = {
    expected: today.length,
    present: today.filter((r) => r.status === 'PRESENT' || r.status === 'LATE' || r.status === 'COMPLETED').length,
    late: today.filter((r) => r.status === 'LATE').length,
    absent: today.filter((r) => r.status === 'ABSENT').length,
    notArrived: today.filter((r) => r.status === 'NOT_ARRIVED').length,
    exceptions,
    unmatchedPunches: unmatched,
    detectedOtDays: otPending,
  };
  return void res.json({ status: 'success', data: { date, metrics, today } });
});

router.get('/today', authorizeAttendance('view'), async (req: AuthRequest, res: Response) => {
  const cid = getCompanyId(req);
  if (!cid) return void res.status(400).json({ status: 'error', message: 'معرّف الشركة مطلوب' });
  const date = (req.query.date as string) || new Date().toISOString().slice(0, 10);
  const data = await todayAttendanceService.list(
    cid,
    new Date(`${date}T00:00:00.000Z`),
    {
      branchId: req.query.branchId as string | undefined,
      shiftId: req.query.shiftId as string | undefined,
    },
    (req.query.timezone as string) || 'UTC'
  );
  return void res.json({ status: 'success', data });
});

router.post('/punches', authorizeAttendance('manage'), async (req: AuthRequest, res: Response) => {
  const cid = getCompanyId(req);
  if (!cid) return void res.status(400).json({ status: 'error', message: 'معرّف الشركة مطلوب' });
  const data = await punchIngestionService.ingest(cid, {
    source: req.body.source ?? 'MANUAL',
    punchedAt: new Date(req.body.punchedAt),
    timezone: req.body.timezone ?? 'UTC',
    punchType: req.body.punchType,
    deviceId: req.body.deviceId,
    externalEmployeeCode: req.body.externalEmployeeCode,
    employeeId: req.body.employeeId,
    externalPunchId: req.body.externalPunchId,
    rawPayload: req.body.rawPayload,
  });
  return void res.status(201).json({ status: 'success', data });
});

router.post('/recalculate', authorizeAttendance('manage'), async (req: AuthRequest, res: Response) => {
  const cid = getCompanyId(req);
  if (!cid) return void res.status(400).json({ status: 'error', message: 'معرّف الشركة مطلوب' });
  const data = await attendanceCalculationService.recalculateDay(
    cid,
    req.body.employmentId,
    new Date(req.body.logicalWorkDate),
    req.body.timezone ?? 'UTC'
  );
  return void res.json({ status: 'success', data });
});

router.post('/batch-recalculate', authorizeAttendance('manage'), async (req: AuthRequest, res: Response) => {
  const cid = getCompanyId(req);
  if (!cid) return void res.status(400).json({ status: 'error', message: 'معرّف الشركة مطلوب' });
  const scope = req.body.scope;
  const data = await enqueueHcmTimeRecalc(cid, scope, req.user?.sub);
  return void res.json({ status: 'success', data });
});

router.get('/exceptions', authorizeAttendance('view'), async (req: AuthRequest, res: Response) => {
  const cid = getCompanyId(req);
  if (!cid) return void res.status(400).json({ status: 'error', message: 'معرّف الشركة مطلوب' });
  const data = await prisma.hcmTimeException.findMany({
    where: {
      companyId: cid,
      status: (req.query.status as string) || 'OPEN',
      ...(req.query.exceptionType ? { exceptionType: req.query.exceptionType as string } : {}),
      ...(req.query.logicalWorkDate
        ? { logicalWorkDate: new Date(`${req.query.logicalWorkDate}T00:00:00.000Z`) }
        : {}),
    },
    orderBy: { createdAt: 'desc' },
    take: 500,
  });
  return void res.json({ status: 'success', data });
});

router.post('/corrections', authorizeAttendance('correct'), async (req: AuthRequest, res: Response) => {
  const cid = getCompanyId(req);
  if (!cid) return void res.status(400).json({ status: 'error', message: 'معرّف الشركة مطلوب' });
  const data = await timeCorrectionService.request(cid, {
    ...req.body,
    logicalWorkDate: new Date(req.body.logicalWorkDate),
    requestedBy: req.user?.sub,
  });
  return void res.status(201).json({ status: 'success', data });
});

router.post('/corrections/:id/approve', authorizeAttendance('approve'), async (req: AuthRequest, res: Response) => {
  const cid = getCompanyId(req);
  if (!cid) return void res.status(400).json({ status: 'error', message: 'معرّف الشركة مطلوب' });
  const data = await timeCorrectionService.approve(
    cid,
    req.params.id,
    req.user?.sub ?? 'system',
    req.body.timezone
  );
  return void res.json({ status: 'success', data });
});

router.post('/corrections/:id/reject', authorizeAttendance('approve'), async (req: AuthRequest, res: Response) => {
  const cid = getCompanyId(req);
  if (!cid) return void res.status(400).json({ status: 'error', message: 'معرّف الشركة مطلوب' });
  const data = await timeCorrectionService.reject(cid, req.params.id, req.user?.sub ?? 'system');
  return void res.json({ status: 'success', data });
});

router.post('/overtime/:attendanceDayId/approve', authorizeAttendance('approve'), async (req: AuthRequest, res: Response) => {
  const cid = getCompanyId(req);
  if (!cid) return void res.status(400).json({ status: 'error', message: 'معرّف الشركة مطلوب' });
  const data = await attendanceCalculationService.approveOvertime(
    cid,
    req.params.attendanceDayId,
    Number(req.body.approvedMinutes),
    req.user?.sub
  );
  return void res.json({ status: 'success', data });
});

router.post('/overtime/:attendanceDayId/reject', authorizeAttendance('approve'), async (req: AuthRequest, res: Response) => {
  const cid = getCompanyId(req);
  if (!cid) return void res.status(400).json({ status: 'error', message: 'معرّف الشركة مطلوب' });
  await attendanceCalculationService.rejectOvertime(cid, req.params.attendanceDayId, req.user?.sub ?? 'system');
  return void res.json({ status: 'success' });
});

router.post('/days/:id/lock', authorizeAttendance('lock'), async (req: AuthRequest, res: Response) => {
  const cid = getCompanyId(req);
  if (!cid) return void res.status(400).json({ status: 'error', message: 'معرّف الشركة مطلوب' });
  const data = await attendanceCalculationService.lockDay(cid, req.params.id, req.user?.sub ?? 'system');
  return void res.json({ status: 'success', data });
});

router.post('/days/:id/unlock', authorizeAttendance('lock'), async (req: AuthRequest, res: Response) => {
  const cid = getCompanyId(req);
  if (!cid) return void res.status(400).json({ status: 'error', message: 'معرّف الشركة مطلوب' });
  const data = await attendanceCalculationService.unlockDay(
    cid,
    req.params.id,
    req.user?.sub ?? 'system',
    String(req.body.reason ?? '')
  );
  return void res.json({ status: 'success', data });
});

router.get('/period-review', authorizeAttendance('view'), async (req: AuthRequest, res: Response) => {
  const cid = getCompanyId(req);
  if (!cid) return void res.status(400).json({ status: 'error', message: 'معرّف الشركة مطلوب' });
  const periodStart = req.query.periodStart as string;
  const periodEnd = req.query.periodEnd as string;
  if (!periodStart || !periodEnd) {
    return void res.status(400).json({ status: 'error', message: 'periodStart و periodEnd مطلوبان' });
  }
  const data = await timePeriodReviewService.assessPeriod(cid, new Date(periodStart), new Date(periodEnd));
  return void res.json({ status: 'success', data });
});

router.post('/period-lock', authorizeAttendance('lock'), async (req: AuthRequest, res: Response) => {
  const cid = getCompanyId(req);
  if (!cid) return void res.status(400).json({ status: 'error', message: 'معرّف الشركة مطلوب' });
  const data = await timePeriodReviewService.lockPeriod(
    cid,
    new Date(req.body.periodStart),
    new Date(req.body.periodEnd),
    req.user?.sub ?? 'system'
  );
  return void res.json({ status: 'success', data });
});

router.post('/period-unlock', authorizeAttendance('lock'), async (req: AuthRequest, res: Response) => {
  const cid = getCompanyId(req);
  if (!cid) return void res.status(400).json({ status: 'error', message: 'معرّف الشركة مطلوب' });
  const data = await timePeriodReviewService.unlockPeriod(
    cid,
    new Date(req.body.periodStart),
    new Date(req.body.periodEnd),
    req.user?.sub ?? 'system',
    String(req.body.reason ?? '')
  );
  return void res.json({ status: 'success', data });
});

router.get('/payroll-summary/:employmentId', authorizeAttendance('view'), async (req: AuthRequest, res: Response) => {
  const cid = getCompanyId(req);
  if (!cid) return void res.status(400).json({ status: 'error', message: 'معرّف الشركة مطلوب' });
  const data = await timePayrollReadService.summarizeEmployeePeriod(
    cid,
    req.params.employmentId,
    new Date(req.query.periodStart as string),
    new Date(req.query.periodEnd as string)
  );
  return void res.json({ status: 'success', data });
});

router.get('/shifts', authorizeAttendance('view'), async (req: AuthRequest, res: Response) => {
  const cid = getCompanyId(req);
  if (!cid) return void res.status(400).json({ status: 'error', message: 'معرّف الشركة مطلوب' });
  const data = await prisma.hcmWorkShift.findMany({ where: { companyId: cid }, orderBy: { code: 'asc' } });
  return void res.json({ status: 'success', data });
});

router.post('/shifts', authorizeAttendance('manage'), async (req: AuthRequest, res: Response) => {
  const cid = getCompanyId(req);
  if (!cid) return void res.status(400).json({ status: 'error', message: 'معرّف الشركة مطلوب' });
  const data = await prisma.hcmWorkShift.create({ data: { companyId: cid, ...req.body } });
  return void res.status(201).json({ status: 'success', data });
});

router.patch('/shifts/:id', authorizeAttendance('manage'), async (req: AuthRequest, res: Response) => {
  const cid = getCompanyId(req);
  if (!cid) return void res.status(400).json({ status: 'error', message: 'معرّف الشركة مطلوب' });
  const existing = await prisma.hcmWorkShift.findFirst({ where: { id: req.params.id, companyId: cid } });
  if (!existing) return void res.status(404).json({ status: 'error', message: 'Not found' });
  const data = await prisma.hcmWorkShift.update({ where: { id: req.params.id }, data: req.body });
  return void res.json({ status: 'success', data });
});

router.get('/schedules', authorizeAttendance('view'), async (req: AuthRequest, res: Response) => {
  const cid = getCompanyId(req);
  if (!cid) return void res.status(400).json({ status: 'error', message: 'معرّف الشركة مطلوب' });
  const data = await prisma.hcmWorkSchedule.findMany({ where: { companyId: cid } });
  return void res.json({ status: 'success', data });
});

router.post('/schedules', authorizeAttendance('manage'), async (req: AuthRequest, res: Response) => {
  const cid = getCompanyId(req);
  if (!cid) return void res.status(400).json({ status: 'error', message: 'معرّف الشركة مطلوب' });
  const data = await prisma.hcmWorkSchedule.create({ data: { companyId: cid, ...req.body } });
  return void res.status(201).json({ status: 'success', data });
});

router.get('/schedule-assignments', authorizeAttendance('view'), async (req: AuthRequest, res: Response) => {
  const cid = getCompanyId(req);
  if (!cid) return void res.status(400).json({ status: 'error', message: 'معرّف الشركة مطلوب' });
  const data = await scheduleAssignmentService.list(cid, req.query.employmentId as string | undefined);
  return void res.json({ status: 'success', data });
});

router.post('/schedule-assignments', authorizeAttendance('manage'), async (req: AuthRequest, res: Response) => {
  const cid = getCompanyId(req);
  if (!cid) return void res.status(400).json({ status: 'error', message: 'معرّف الشركة مطلوب' });
  const data = await scheduleAssignmentService.create(cid, {
    employmentId: req.body.employmentId,
    scheduleId: req.body.scheduleId,
    effectiveFrom: new Date(req.body.effectiveFrom),
    effectiveTo: req.body.effectiveTo ? new Date(req.body.effectiveTo) : null,
  });
  return void res.status(201).json({ status: 'success', data });
});

router.get('/policies', authorizeAttendance('view'), async (req: AuthRequest, res: Response) => {
  const cid = getCompanyId(req);
  if (!cid) return void res.status(400).json({ status: 'error', message: 'معرّف الشركة مطلوب' });
  const data = await prisma.hcmAttendancePolicy.findMany({ where: { companyId: cid } });
  return void res.json({ status: 'success', data });
});

router.post('/policies', authorizeAttendance('manage'), async (req: AuthRequest, res: Response) => {
  const cid = getCompanyId(req);
  if (!cid) return void res.status(400).json({ status: 'error', message: 'معرّف الشركة مطلوب' });
  const data = await prisma.hcmAttendancePolicy.create({
    data: {
      companyId: cid,
      code: req.body.code,
      arabicName: req.body.arabicName,
      effectiveFrom: new Date(req.body.effectiveFrom),
      effectiveTo: req.body.effectiveTo ? new Date(req.body.effectiveTo) : null,
      rules: req.body.rules,
    },
  });
  return void res.status(201).json({ status: 'success', data });
});

router.get('/devices', authorizeAttendance('view'), async (req: AuthRequest, res: Response) => {
  const cid = getCompanyId(req);
  if (!cid) return void res.status(400).json({ status: 'error', message: 'معرّف الشركة مطلوب' });
  const rows = await prisma.hcmTimeDevice.findMany({ where: { companyId: cid } });
  return void res.json({ status: 'success', data: rows.map(stripDeviceSecrets) });
});

router.post('/devices', authorizeAttendance('device_manage'), async (req: AuthRequest, res: Response) => {
  const cid = getCompanyId(req);
  if (!cid) return void res.status(400).json({ status: 'error', message: 'معرّف الشركة مطلوب' });
  const data = await prisma.hcmTimeDevice.create({
    data: {
      companyId: cid,
      code: req.body.code,
      name: req.body.name,
      branchId: req.body.branchId,
      timezone: req.body.timezone ?? 'UTC',
      providerType: req.body.providerType ?? 'MANUAL',
      config: req.body.config,
      isActive: req.body.isActive ?? true,
    },
  });
  return void res.status(201).json({ status: 'success', data: stripDeviceSecrets(data) });
});

router.get('/devices/:deviceId/mappings', authorizeAttendance('view'), async (req: AuthRequest, res: Response) => {
  const cid = getCompanyId(req);
  if (!cid) return void res.status(400).json({ status: 'error', message: 'معرّف الشركة مطلوب' });
  const data = await prisma.hcmDeviceEmployeeMapping.findMany({
    where: { companyId: cid, deviceId: req.params.deviceId },
  });
  return void res.json({ status: 'success', data });
});

router.post('/devices/:deviceId/mappings', authorizeAttendance('device_manage'), async (req: AuthRequest, res: Response) => {
  const cid = getCompanyId(req);
  if (!cid) return void res.status(400).json({ status: 'error', message: 'معرّف الشركة مطلوب' });
  const data = await prisma.hcmDeviceEmployeeMapping.create({
    data: {
      companyId: cid,
      deviceId: req.params.deviceId,
      externalEmployeeCode: req.body.externalEmployeeCode,
      employeeId: req.body.employeeId,
      employmentId: req.body.employmentId,
    },
  });
  return void res.status(201).json({ status: 'success', data });
});

router.post('/import/csv/preview', authorizeAttendance('device_manage'), async (req: AuthRequest, res: Response) => {
  const data = csvPunchImportService.preview(String(req.body.csvText ?? ''), req.body.timezone ?? 'UTC');
  return void res.json({ status: 'success', data });
});

router.post('/import/csv', authorizeAttendance('device_manage'), async (req: AuthRequest, res: Response) => {
  const cid = getCompanyId(req);
  if (!cid) return void res.status(400).json({ status: 'error', message: 'معرّف الشركة مطلوب' });
  const data = await csvPunchImportService.import(
    cid,
    req.body.deviceId,
    String(req.body.csvText ?? ''),
    req.body.timezone ?? 'UTC'
  );
  return void res.json({ status: 'success', data });
});

router.get('/corrections', authorizeAttendance('view'), async (req: AuthRequest, res: Response) => {
  const cid = getCompanyId(req);
  if (!cid) return void res.status(400).json({ status: 'error', message: 'معرّف الشركة مطلوب' });
  const data = await prisma.hcmTimeCorrection.findMany({
    where: { companyId: cid, status: (req.query.status as string) || undefined },
    orderBy: { createdAt: 'desc' },
    take: 200,
  });
  return void res.json({ status: 'success', data });
});

router.get('/days', authorizeAttendance('view'), async (req: AuthRequest, res: Response) => {
  const cid = getCompanyId(req);
  if (!cid) return void res.status(400).json({ status: 'error', message: 'معرّف الشركة مطلوب' });
  const employmentId = req.query.employmentId as string;
  const periodStart = req.query.periodStart as string;
  const periodEnd = req.query.periodEnd as string;
  const data = await prisma.hcmAttendanceDay.findMany({
    where: {
      companyId: cid,
      employmentId,
      logicalWorkDate: {
        gte: new Date(`${periodStart}T00:00:00.000Z`),
        lte: new Date(`${periodEnd}T00:00:00.000Z`),
      },
    },
    orderBy: { logicalWorkDate: 'asc' },
  });
  return void res.json({ status: 'success', data });
});

export default router;
