import { PrismaClient } from '@prisma/client';
import { createTimeFixture, teardownTimeFixture } from '../helpers/hcm-time-fixture';
import { scheduleResolutionService } from '../../modules/hr/services/time/schedule-resolution.service';
import { scheduleAssignmentService } from '../../modules/hr/services/time/schedule-assignment.service';
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

describeDb('HCM transfer × schedule resolution', () => {
  jest.setTimeout(120_000);

  it('historical June uses schedule A, July uses schedule B', async () => {
    const fx = await createTimeFixture(prisma, {});
    const shiftA = fx.dayShiftId;
    const shiftB = (
      await prisma.hcmWorkShift.create({
        data: {
          companyId: fx.companyId,
          code: `B-${Date.now()}`,
          arabicName: 'Late',
          startTimeMinutes: 10 * 60,
          endTimeMinutes: 18 * 60,
          expectedWorkMinutes: 480,
        },
      })
    ).id;

    const schedA = await prisma.hcmWorkSchedule.findUnique({ where: { id: fx.scheduleId } });
    const schedB = await prisma.hcmWorkSchedule.create({
      data: {
        companyId: fx.companyId,
        code: `SCH-B-${Date.now()}`,
        arabicName: 'Schedule B',
        scheduleType: 'FIXED_WEEKLY',
        pattern: { weekly: { '0': shiftB, '1': shiftB, '2': shiftB, '3': shiftB, '4': shiftB, '5': shiftB, '6': shiftB } },
      },
    });

    await prisma.hcmEmployeeScheduleAssignment.deleteMany({ where: { companyId: fx.companyId, employmentId: fx.employmentId } });
    await scheduleAssignmentService.create(fx.companyId, {
      employmentId: fx.employmentId,
      scheduleId: schedA!.id,
      effectiveFrom: new Date('2026-01-01'),
      effectiveTo: new Date('2026-06-30'),
    });
    await scheduleAssignmentService.create(fx.companyId, {
      employmentId: fx.employmentId,
      scheduleId: schedB.id,
      effectiveFrom: new Date('2026-07-01'),
    });

    const june = await scheduleResolutionService.resolve(
      fx.companyId,
      fx.employmentId,
      toDateOnly('2026-06-15'),
      'UTC'
    );
    const july = await scheduleResolutionService.resolve(
      fx.companyId,
      fx.employmentId,
      toDateOnly('2026-07-15'),
      'UTC'
    );
    expect(june.shift?.id).toBe(shiftA);
    expect(july.shift?.id).toBe(shiftB);
    await teardownTimeFixture(prisma, fx.companyId);
  });

  it('rejects overlapping schedule assignments', async () => {
    const fx = await createTimeFixture(prisma, {});
    await expect(
      scheduleAssignmentService.create(fx.companyId, {
        employmentId: fx.employmentId,
        scheduleId: fx.scheduleId,
        effectiveFrom: new Date('2026-03-01'),
        effectiveTo: new Date('2026-12-31'),
      })
    ).rejects.toThrow();
    await teardownTimeFixture(prisma, fx.companyId);
  });
});
