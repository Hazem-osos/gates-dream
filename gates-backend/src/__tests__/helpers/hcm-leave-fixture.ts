import { PrismaClient } from '@prisma/client';
import { createTimeFixture } from './hcm-time-fixture';
import { hcmLeaveSetupService } from '../../modules/hr/services/leave/hcm-leave-setup.service';

export type LeaveFixture = Awaited<ReturnType<typeof createLeaveFixture>>;

export async function createLeaveFixture(prisma: PrismaClient) {
  const time = await createTimeFixture(prisma, { hireDate: '2026-01-01' });
  const catalog = await hcmLeaveSetupService.bootstrapEmployment(
    time.companyId,
    time.employmentId,
    time.employeeId,
    new Date('2026-01-01')
  );

  // Sun–Thu work (0=Sun … 4=Thu), Fri/Sat off
  const schedule = await prisma.hcmWorkSchedule.findFirst({
    where: { id: time.scheduleId },
  });
  if (schedule?.pattern && typeof schedule.pattern === 'object') {
    const weekly = { ...(schedule.pattern as { weekly: Record<string, string> }).weekly };
    weekly['5'] = '';
    weekly['6'] = '';
    await prisma.hcmWorkSchedule.update({
      where: { id: time.scheduleId },
      data: { pattern: { weekly } },
    });
  }

  return { ...time, ...catalog };
}
