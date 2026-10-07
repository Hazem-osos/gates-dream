import prisma from '../../shared/database/prisma';
import { createLeaveFixture } from '../helpers/hcm-leave-fixture';
import { leaveRequestService } from '../../modules/hr/services/leave/leave-request.service';
import { leaveBalanceService } from '../../modules/hr/services/leave/leave-balance.service';
import { attendanceCalculationService } from '../../modules/hr/services/time/attendance-calculation.service';
import { punchIngestionService } from '../../modules/hr/services/time/punch-ingestion.service';

describe('HCM Phase 4 leave E2E', () => {
  it('policy → entitlement → request → approve → time classification → cancel', async () => {
    const fx = await createLeaveFixture(prisma);

    await prisma.hcmCalendarDay.create({
      data: {
        companyId: fx.companyId,
        calendarDate: new Date('2026-02-10T00:00:00.000Z'),
        dayType: 'PUBLIC_HOLIDAY',
        name: 'Holiday',
      },
    });

    const draft = await leaveRequestService.createDraft(fx.companyId, {
      employmentId: fx.employmentId,
      employeeId: fx.employeeId,
      leaveTypeId: fx.annualTypeId,
      startDate: new Date('2026-02-09T00:00:00.000Z'),
      endDate: new Date('2026-02-11T00:00:00.000Z'),
      timezone: 'Africa/Cairo',
    });
    expect(Number(draft.calculatedQuantity)).toBe(2);

    await leaveRequestService.submit(fx.companyId, draft.id, 'test-user');
    const balAfterSubmit = await leaveBalanceService.getLeaveBalance(
      fx.companyId,
      fx.employmentId,
      fx.annualTypeId,
      new Date('2026-02-09')
    );
    expect(Number(balAfterSubmit.reserved)).toBe(2);

    await leaveRequestService.approve(fx.companyId, draft.id, 'approver');

    const leaveDay = new Date('2026-02-09T00:00:00.000Z');
    const day = await attendanceCalculationService.recalculateDay(
      fx.companyId,
      fx.employmentId,
      leaveDay,
      'Africa/Cairo'
    );
    expect(day.absenceMinutes).toBe(0);
    expect(day.paidLeaveMinutes).toBeGreaterThan(0);

    await leaveRequestService.cancelApproved(fx.companyId, draft.id, 'hr');
    const balAfterCancel = await leaveBalanceService.getLeaveBalance(
      fx.companyId,
      fx.employmentId,
      fx.annualTypeId,
      new Date('2026-02-12')
    );
    expect(Number(balAfterCancel.ledgerNet)).toBeGreaterThanOrEqual(19);
  });

  it('partial hourly leave does not double-count absence', async () => {
    const fx = await createLeaveFixture(prisma);
    const workDate = new Date('2026-03-02T00:00:00.000Z');

    const draft = await leaveRequestService.createDraft(fx.companyId, {
      employmentId: fx.employmentId,
      employeeId: fx.employeeId,
      leaveTypeId: fx.annualTypeId,
      startDate: workDate,
      endDate: workDate,
      segmentType: 'HOURLY',
      hourlyStart: new Date('2026-03-02T09:00:00.000Z'),
      hourlyEnd: new Date('2026-03-02T13:00:00.000Z'),
      timezone: 'Africa/Cairo',
    });
    await leaveRequestService.submit(fx.companyId, draft.id, 'u');
    await leaveRequestService.approve(fx.companyId, draft.id, 'a');

    for (const p of [
      { at: new Date('2026-03-02T13:00:00.000Z'), type: 'IN' },
      { at: new Date('2026-03-02T17:00:00.000Z'), type: 'OUT' },
    ]) {
      await punchIngestionService.ingest(fx.companyId, {
        source: 'MANUAL',
        punchedAt: p.at,
        punchType: p.type,
        employeeId: fx.employeeId,
        timezone: 'Africa/Cairo',
      });
    }

    const day = await attendanceCalculationService.recalculateDay(
      fx.companyId,
      fx.employmentId,
      workDate,
      'Africa/Cairo'
    );
    expect(day.workedMinutes).toBeGreaterThanOrEqual(200);
    expect(day.absenceMinutes).toBe(0);
    expect(day.paidLeaveMinutes).toBeGreaterThan(0);
  });
});
