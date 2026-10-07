import { PrismaClient } from '@prisma/client';
import { createTimeFixture, teardownTimeFixture } from '../helpers/hcm-time-fixture';
import { punchIngestionService } from '../../modules/hr/services/time/punch-ingestion.service';
import { attendanceCalculationService } from '../../modules/hr/services/time/attendance-calculation.service';
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

describeDb('HCM lifecycle × time matrix', () => {
  jest.setTimeout(120_000);

  it('punch before hire rejected on recalc', async () => {
    const fx = await createTimeFixture(prisma, { hireDate: '2026-06-01' });
    await expect(
      attendanceCalculationService.recalculateDay(fx.companyId, fx.employmentId, toDateOnly('2026-01-15'), 'UTC')
    ).rejects.toThrow();
    await teardownTimeFixture(prisma, fx.companyId);
  });

  it('attendance on hire date allowed', async () => {
    const fx = await createTimeFixture(prisma, { hireDate: '2026-06-01' });
    const d = await attendanceCalculationService.recalculateDay(
      fx.companyId,
      fx.employmentId,
      toDateOnly('2026-06-01'),
      'UTC'
    );
    expect(d.employmentId).toBe(fx.employmentId);
    await teardownTimeFixture(prisma, fx.companyId);
  });

  it('after termination recalc rejected', async () => {
    const fx = await createTimeFixture(prisma, { hireDate: '2026-01-01' });
    await prisma.hcmEmployment.update({
      where: { id: fx.employmentId },
      data: { status: 'TERMINATED', terminationDate: new Date('2026-05-31') },
    });
    await expect(
      attendanceCalculationService.recalculateDay(fx.companyId, fx.employmentId, toDateOnly('2026-06-15'), 'UTC')
    ).rejects.toThrow();
    await teardownTimeFixture(prisma, fx.companyId);
  });

  it('punches attach to active employment episode', async () => {
    const fx = await createTimeFixture(prisma, {});
    await punchIngestionService.ingest(fx.companyId, {
      source: 'MANUAL',
      punchedAt: new Date('2026-08-10T09:00:00.000Z'),
      timezone: 'UTC',
      punchType: 'IN',
      employeeId: fx.employeeId,
      externalPunchId: 'ep-in',
    });
    const punch = await prisma.hcmTimePunch.findFirst({
      where: { companyId: fx.companyId, externalPunchId: 'ep-in' },
    });
    expect(punch?.employmentId).toBe(fx.employmentId);
    await teardownTimeFixture(prisma, fx.companyId);
  });
});
