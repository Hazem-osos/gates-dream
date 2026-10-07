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

describeDb('raw punch immutability', () => {
  jest.setTimeout(60_000);

  it('recalculation does not mutate HcmTimePunch.punchedAt', async () => {
    const fx = await createTimeFixture(prisma, {});
    const at = new Date('2026-11-01T09:07:33.000Z');
    const { punch } = await punchIngestionService.ingest(fx.companyId, {
      source: 'MANUAL',
      punchedAt: at,
      timezone: 'UTC',
      punchType: 'IN',
      employeeId: fx.employeeId,
      externalPunchId: 'imm-1',
    });
    await punchIngestionService.ingest(fx.companyId, {
      source: 'MANUAL',
      punchedAt: new Date('2026-11-01T17:00:00.000Z'),
      timezone: 'UTC',
      punchType: 'OUT',
      employeeId: fx.employeeId,
      externalPunchId: 'imm-2',
    });
    await attendanceCalculationService.recalculateDay(
      fx.companyId,
      fx.employmentId,
      toDateOnly('2026-11-01'),
      'UTC'
    );
    const after = await prisma.hcmTimePunch.findUnique({ where: { id: punch.id } });
    expect(after?.punchedAt.toISOString()).toBe(at.toISOString());
    await teardownTimeFixture(prisma, fx.companyId);
  });
});
