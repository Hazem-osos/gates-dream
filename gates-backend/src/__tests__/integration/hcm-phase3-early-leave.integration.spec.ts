import { PrismaClient } from '@prisma/client';
import { createTimeFixture, teardownTimeFixture } from '../helpers/hcm-time-fixture';
import { punchIngestionService } from '../../modules/hr/services/time/punch-ingestion.service';
import { attendanceCalculationService } from '../../modules/hr/services/time/attendance-calculation.service';
import { timeCorrectionService } from '../../modules/hr/services/time/time-correction.service';
import { toDateOnly } from '../../modules/hr/utils/hr-effective-date.util';

const dbName = (() => {
  try {
    return new URL(process.env.DATABASE_URL ?? '').pathname.replace(/^\//, '');
  } catch {
    return '';
  }
})();
const describeDb = dbName ? describe : describe.skip;
const prisma = new PrismaClient();

async function dayResult(
  companyId: string,
  employmentId: string,
  employeeId: string,
  date: string,
  inAt: string,
  outAt: string
) {
  await punchIngestionService.ingest(companyId, {
    source: 'MANUAL',
    punchedAt: new Date(inAt),
    timezone: 'UTC',
    punchType: 'IN',
    employeeId,
    externalPunchId: `${date}-in-${inAt}`,
  });
  await punchIngestionService.ingest(companyId, {
    source: 'MANUAL',
    punchedAt: new Date(outAt),
    timezone: 'UTC',
    punchType: 'OUT',
    employeeId,
    externalPunchId: `${date}-out-${outAt}`,
  });
  return prisma.hcmAttendanceDay.findFirst({
    where: { employmentId, logicalWorkDate: toDateOnly(date) },
  });
}

describeDb('HCM early leave matrix', () => {
  jest.setTimeout(180_000);

  it('normal early leave outside grace', async () => {
    const fx = await createTimeFixture(prisma, { policy: { earlyLeaveGraceMinutes: 5 } });
    const d = await dayResult(fx.companyId, fx.employmentId, fx.employeeId, '2026-04-01', '2026-04-01T09:00:00.000Z', '2026-04-01T16:30:00.000Z');
    expect(d?.earlyLeaveMinutes).toBe(30);
    expect(d?.workedMinutes).toBe(450);
    await teardownTimeFixture(prisma, fx.companyId);
  });

  it('within early-leave grace', async () => {
    const fx = await createTimeFixture(prisma, { policy: { earlyLeaveGraceMinutes: 15 } });
    const d = await dayResult(fx.companyId, fx.employmentId, fx.employeeId, '2026-04-02', '2026-04-02T09:00:00.000Z', '2026-04-02T16:50:00.000Z');
    expect(d?.earlyLeaveMinutes).toBe(0);
    await teardownTimeFixture(prisma, fx.companyId);
  });

  it('exact grace boundary', async () => {
    const fx = await createTimeFixture(prisma, { policy: { earlyLeaveGraceMinutes: 10 } });
    const d = await dayResult(fx.companyId, fx.employmentId, fx.employeeId, '2026-04-03', '2026-04-03T09:00:00.000Z', '2026-04-03T16:50:00.000Z');
    expect(d?.earlyLeaveMinutes).toBe(0);
    const d2 = await dayResult(fx.companyId, fx.employmentId, fx.employeeId, '2026-04-04', '2026-04-04T09:00:00.000Z', '2026-04-04T16:49:00.000Z');
    expect(d2?.earlyLeaveMinutes).toBe(11);
    await teardownTimeFixture(prisma, fx.companyId);
  });

  it('no early leave when leaving on time', async () => {
    const fx = await createTimeFixture(prisma, {});
    const d = await dayResult(fx.companyId, fx.employmentId, fx.employeeId, '2026-04-05', '2026-04-05T09:00:00.000Z', '2026-04-05T17:00:00.000Z');
    expect(d?.earlyLeaveMinutes).toBe(0);
    await teardownTimeFixture(prisma, fx.companyId);
  });

  it('late and early leave same day', async () => {
    const fx = await createTimeFixture(prisma, { policy: { lateGraceMinutes: 0, earlyLeaveGraceMinutes: 0 } });
    const d = await dayResult(fx.companyId, fx.employmentId, fx.employeeId, '2026-04-06', '2026-04-06T09:20:00.000Z', '2026-04-06T16:40:00.000Z');
    expect(d?.lateMinutes).toBe(20);
    expect(d?.earlyLeaveMinutes).toBe(20);
    await teardownTimeFixture(prisma, fx.companyId);
  });

  it('approved correction changing OUT', async () => {
    const fx = await createTimeFixture(prisma, { policy: { earlyLeaveGraceMinutes: 0 } });
    await punchIngestionService.ingest(fx.companyId, {
      source: 'MANUAL',
      punchedAt: new Date('2026-04-07T09:00:00.000Z'),
      timezone: 'UTC',
      punchType: 'IN',
      employeeId: fx.employeeId,
      externalPunchId: 'ec-in',
    });
    const corr = await timeCorrectionService.request(fx.companyId, {
      employmentId: fx.employmentId,
      logicalWorkDate: toDateOnly('2026-04-07'),
      correctionType: 'MISSING_OUT',
      payload: { addPunches: [{ at: '2026-04-07T17:00:00.000Z', type: 'OUT' }] },
    });
    await timeCorrectionService.approve(fx.companyId, corr.id, 'mgr', 'UTC');
    const d = await prisma.hcmAttendanceDay.findFirst({
      where: { employmentId: fx.employmentId, logicalWorkDate: toDateOnly('2026-04-07') },
    });
    expect(d?.earlyLeaveMinutes).toBe(0);
    expect(d?.workedMinutes).toBe(480);
    await teardownTimeFixture(prisma, fx.companyId);
  });

  it('rest day has no scheduled early leave', async () => {
    const fx = await createTimeFixture(prisma, {});
    await prisma.hcmCalendarDay.create({
      data: { companyId: fx.companyId, calendarDate: toDateOnly('2026-04-08'), dayType: 'REST_DAY' },
    });
    const d = await attendanceCalculationService.recalculateDay(
      fx.companyId,
      fx.employmentId,
      toDateOnly('2026-04-08'),
      'UTC'
    );
    expect(d.dayClassification).toBe('REST_DAY');
    expect(d.earlyLeaveMinutes).toBe(0);
    await teardownTimeFixture(prisma, fx.companyId);
  });

  it('holiday classification', async () => {
    const fx = await createTimeFixture(prisma, {});
    await prisma.hcmCalendarDay.create({
      data: { companyId: fx.companyId, calendarDate: toDateOnly('2026-04-09'), dayType: 'PUBLIC_HOLIDAY' },
    });
    const d = await attendanceCalculationService.recalculateDay(
      fx.companyId,
      fx.employmentId,
      toDateOnly('2026-04-09'),
      'UTC'
    );
    expect(['PUBLIC_HOLIDAY', 'HOLIDAY', 'REST_DAY']).toContain(d.dayClassification);
    await teardownTimeFixture(prisma, fx.companyId);
  });
});
