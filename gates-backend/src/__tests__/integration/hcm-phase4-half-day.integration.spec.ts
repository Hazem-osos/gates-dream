import prisma from '../../shared/database/prisma';
import { createLeaveFixture } from '../helpers/hcm-leave-fixture';
import { leaveRequestCalculationService } from '../../modules/hr/services/leave/leave-request-calculation.service';

describe('HCM Phase 4 half-day', () => {
  it('charges 0.5 day for HALF_AM on scheduled work day', async () => {
    const fx = await createLeaveFixture(prisma);
    const workDate = new Date('2026-05-04T00:00:00.000Z');
    const preview = await leaveRequestCalculationService.preview(
      fx.companyId,
      fx.employmentId,
      fx.annualTypeId,
      workDate,
      workDate,
      { segmentType: 'HALF_AM', timezone: 'Africa/Cairo' }
    );
    expect(preview.days[0]?.chargeableDays).toBe('0.5000');
    expect(Number(preview.totalChargeableDays)).toBe(0.5);
  });
});
