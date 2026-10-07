import { PrismaClient } from '@prisma/client';
import { createTimeFixture, teardownTimeFixture } from '../helpers/hcm-time-fixture';
import { resolveLogicalWorkDateForPunch } from '../../modules/hr/services/time/logical-work-date.service';
import { punchIngestionService } from '../../modules/hr/services/time/punch-ingestion.service';
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

describeDb('HCM overnight boundary matrix', () => {
  jest.setTimeout(180_000);
  let fx: Awaited<ReturnType<typeof createTimeFixture>>;

  beforeEach(async () => {
    fx = await createTimeFixture(prisma, { weeklyShiftId: 'night' });
  });

  afterEach(async () => {
    await teardownTimeFixture(prisma, fx.companyId);
  });

  const logical = async (iso: string) =>
    (await resolveLogicalWorkDateForPunch(fx.companyId, fx.employmentId, new Date(iso), 'UTC'))
      .toISOString()
      .slice(0, 10);

  it('shift start boundaries 21:59 / 22:00 / 22:01', async () => {
    expect(await logical('2026-05-10T21:59:00.000Z')).toBe('2026-05-10');
    expect(await logical('2026-05-10T22:00:00.000Z')).toBe('2026-05-10');
    expect(await logical('2026-05-10T22:01:00.000Z')).toBe('2026-05-10');
  });

  it('midnight crossing 23:59 and 00:01', async () => {
    expect(await logical('2026-05-10T23:59:00.000Z')).toBe('2026-05-10');
    expect(await logical('2026-05-11T00:01:00.000Z')).toBe('2026-05-10');
  });

  it('shift end boundaries 05:59 / 06:00 / 06:01', async () => {
    expect(await logical('2026-05-11T05:59:00.000Z')).toBe('2026-05-10');
    expect(await logical('2026-05-11T06:00:00.000Z')).toBe('2026-05-10');
    expect(await logical('2026-05-11T06:04:00.000Z')).toBe('2026-05-10');
  });

  it('full overnight pair creates single logical day', async () => {
    await punchIngestionService.ingest(fx.companyId, {
      source: 'MANUAL',
      punchedAt: new Date('2026-05-12T21:57:00.000Z'),
      timezone: 'UTC',
      punchType: 'IN',
      employeeId: fx.employeeId,
      externalPunchId: 'on-in',
    });
    await punchIngestionService.ingest(fx.companyId, {
      source: 'MANUAL',
      punchedAt: new Date('2026-05-13T06:04:00.000Z'),
      timezone: 'UTC',
      punchType: 'OUT',
      employeeId: fx.employeeId,
      externalPunchId: 'on-out',
    });
    const days = await prisma.hcmAttendanceDay.findMany({
      where: { employmentId: fx.employmentId, logicalWorkDate: { gte: toDateOnly('2026-05-12'), lte: toDateOnly('2026-05-13') } },
    });
    expect(days.length).toBe(1);
    expect(days[0].logicalWorkDate.toISOString().slice(0, 10)).toBe('2026-05-12');
    expect(days[0].workedMinutes).toBeGreaterThan(0);
  });

  it('consecutive overnight work dates stay separate', async () => {
    for (const [d, suffix] of [
      ['2026-05-14', 'a'],
      ['2026-05-15', 'b'],
    ] as const) {
      await punchIngestionService.ingest(fx.companyId, {
        source: 'MANUAL',
        punchedAt: new Date(`${d}T22:00:00.000Z`),
        timezone: 'UTC',
        punchType: 'IN',
        employeeId: fx.employeeId,
        externalPunchId: `${suffix}-in`,
      });
      const next = new Date(`${d}T00:00:00.000Z`);
      next.setUTCDate(next.getUTCDate() + 1);
      await punchIngestionService.ingest(fx.companyId, {
        source: 'MANUAL',
        punchedAt: new Date(next.toISOString().slice(0, 10) + 'T06:00:00.000Z'),
        timezone: 'UTC',
        punchType: 'OUT',
        employeeId: fx.employeeId,
        externalPunchId: `${suffix}-out`,
      });
    }
    const count = await prisma.hcmAttendanceDay.count({
      where: {
        employmentId: fx.employmentId,
        logicalWorkDate: { in: [toDateOnly('2026-05-14'), toDateOnly('2026-05-15')] },
      },
    });
    expect(count).toBe(2);
  });
});
