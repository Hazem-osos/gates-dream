import prisma from '../../shared/database/prisma';
import { createLeaveFixture } from '../helpers/hcm-leave-fixture';
import { leaveRequestService } from '../../modules/hr/services/leave/leave-request.service';

describe('HCM Phase 4.1 backdated leave impact', () => {
  it('submit attaches payroll impact metadata without mutating payroll', async () => {
    const fx = await createLeaveFixture(prisma);
    const draft = await leaveRequestService.createDraft(fx.companyId, {
      employmentId: fx.employmentId,
      employeeId: fx.employeeId,
      leaveTypeId: fx.annualTypeId,
      startDate: new Date('2026-01-15'),
      endDate: new Date('2026-01-15'),
    });
    const submitted = await leaveRequestService.submit(fx.companyId, draft.id, 'u');
    const detail = submitted.calculationDetail as { payrollImpact?: { impacted: boolean } };
    expect(detail.payrollImpact).toBeDefined();
  });
});
