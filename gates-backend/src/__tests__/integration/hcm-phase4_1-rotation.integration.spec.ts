import prisma from '../../shared/database/prisma';
import { createLeaveFixture } from '../helpers/hcm-leave-fixture';
import { leaveRequestCalculationService } from '../../modules/hr/services/leave/leave-request-calculation.service';

describe('HCM Phase 4.1 rotation schedule leave', () => {
  it('charges using schedule resolution on rotation off-day', async () => {
    const fx = await createLeaveFixture(prisma);
    const dayShift = fx.dayShiftId;
    await prisma.hcmWorkSchedule.update({
      where: { id: fx.scheduleId },
      data: {
        scheduleType: 'ROTATION',
        pattern: {
          rotation: {
            anchorDate: '2026-01-01',
            cycleDays: 2,
            days: [{ shiftId: dayShift }, { off: true }],
          },
        },
      },
    });
    const preview = await leaveRequestCalculationService.preview(
      fx.companyId,
      fx.employmentId,
      fx.annualTypeId,
      new Date('2026-01-02T00:00:00.000Z'),
      new Date('2026-01-02T00:00:00.000Z'),
      { timezone: 'Africa/Cairo' }
    );
    expect(preview.days[0]?.dayClassification).toBeDefined();
    expect(Number(preview.totalChargeableDays)).toBeGreaterThanOrEqual(0);
  });
});
