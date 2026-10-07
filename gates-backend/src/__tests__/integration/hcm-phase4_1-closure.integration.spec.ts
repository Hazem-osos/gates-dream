import { Decimal } from '@prisma/client/runtime/library';
import prisma from '../../shared/database/prisma';
import { createLeaveFixture } from '../helpers/hcm-leave-fixture';
import { leaveRequestCalculationService } from '../../modules/hr/services/leave/leave-request-calculation.service';
import { leaveEncashmentService } from '../../modules/hr/services/leave/leave-encashment.service';
import { leavePolicyGuardsService } from '../../modules/hr/services/leave/leave-policy-guards.service';
import { leaveRequestService } from '../../modules/hr/services/leave/leave-request.service';
import { leaveEntitlementService } from '../../modules/hr/services/leave/leave-entitlement.service';
import { runLeaveAccrualSync } from '../../modules/hr/services/leave/hcm-leave-job.service';
import { leaveLedgerService } from '../../modules/hr/services/leave/leave-ledger.service';

describe('HCM Phase 4.1 closure matrix', () => {
  it('sandwich rule OFF excludes rest between leave days', async () => {
    const fx = await createLeaveFixture(prisma);
    await prisma.hcmLeavePolicy.update({
      where: { id: fx.policyId },
      data: { rules: { sandwichRule: false, countWeekends: false } },
    });
    const preview = await leaveRequestCalculationService.preview(
      fx.companyId,
      fx.employmentId,
      fx.annualTypeId,
      new Date('2026-02-05T00:00:00.000Z'),
      new Date('2026-02-07T00:00:00.000Z'),
      { timezone: 'Africa/Cairo' }
    );
    const restDays = preview.days.filter((d) => d.excludedReason === 'rest_day');
    expect(restDays.length).toBeGreaterThan(0);
    expect(Number(preview.totalChargeableDays)).toBeLessThan(preview.calendarDays);
  });

  it('sandwich rule ON charges rest between leave boundaries', async () => {
    const fx = await createLeaveFixture(prisma);
    await prisma.hcmLeavePolicy.update({
      where: { id: fx.policyId },
      data: { rules: { sandwichRule: false, countWeekends: false } },
    });
    const off = await leaveRequestCalculationService.preview(
      fx.companyId,
      fx.employmentId,
      fx.annualTypeId,
      new Date('2026-02-05T00:00:00.000Z'),
      new Date('2026-02-09T00:00:00.000Z'),
      { timezone: 'Africa/Cairo' }
    );
    await prisma.hcmLeavePolicy.update({
      where: { id: fx.policyId },
      data: { rules: { sandwichRule: true, countWeekends: false } },
    });
    const on = await leaveRequestCalculationService.preview(
      fx.companyId,
      fx.employmentId,
      fx.annualTypeId,
      new Date('2026-02-05T00:00:00.000Z'),
      new Date('2026-02-09T00:00:00.000Z'),
      { timezone: 'Africa/Cairo' }
    );
    expect(Number(on.totalChargeableDays)).toBeGreaterThan(Number(off.totalChargeableDays));
    expect(on.days.some((d) => d.excludedReason === 'sandwich')).toBe(true);
  });

  it('encashment posts ENCASHMENT and reversal restores via adjustment credit', async () => {
    const fx = await createLeaveFixture(prisma);
    const entry = await leaveEncashmentService.encash(fx.companyId, {
      employmentId: fx.employmentId,
      leaveTypeId: fx.annualTypeId,
      quantity: 2,
      effectiveDate: new Date('2026-05-01'),
    });
    expect(entry.transactionType).toBe('ENCASHMENT');
    const rev = await leaveEncashmentService.reverse(fx.companyId, entry.id, 'hr');
    expect(rev.transactionType).toBe('ADJUSTMENT_CREDIT');
  });

  it('attachment required blocks submit without reference', async () => {
    const fx = await createLeaveFixture(prisma);
    const sick = await prisma.hcmLeaveType.create({
      data: {
        companyId: fx.companyId,
        code: `SICKR-${Date.now()}`,
        arabicName: 'Sick R',
        requiresAttachment: true,
        requiresBalance: false,
        attendanceClassification: 'SICK_LEAVE',
      },
    });
    const draft = await leaveRequestService.createDraft(fx.companyId, {
      employmentId: fx.employmentId,
      employeeId: fx.employeeId,
      leaveTypeId: sick.id,
      startDate: new Date('2026-06-01'),
      endDate: new Date('2026-06-01'),
    });
    await expect(leaveRequestService.submit(fx.companyId, draft.id, 'u')).rejects.toThrow(/Attachment/);
    await prisma.hcmLeaveRequest.update({
      where: { id: draft.id },
      data: { attachmentRef: 'doc:ref-1' },
    });
    await expect(leaveRequestService.submit(fx.companyId, draft.id, 'u')).resolves.toBeTruthy();
  });

  it('probation NO_USAGE blocks submit', async () => {
    const fx = await createLeaveFixture(prisma);
    await prisma.hcmLeavePolicy.update({
      where: { id: fx.policyId },
      data: { rules: { probationMode: 'NO_USAGE' } },
    });
    await prisma.hcmEmployment.update({
      where: { id: fx.employmentId },
      data: { probationEnd: new Date('2026-12-31') },
    });
    await expect(
      leavePolicyGuardsService.assertRequestAllowed(
        fx.companyId,
        fx.employmentId,
        fx.annualTypeId,
        new Date('2026-03-01')
      )
    ).rejects.toThrow(/probation/i);
  });

  it('proration mid-year join is deterministic', async () => {
    const fx = await createLeaveFixture(prisma);
    await prisma.hcmEmployment.update({
      where: { id: fx.employmentId },
      data: { hireDate: new Date('2026-07-01') },
    });
    const r = await leaveEntitlementService.grantAnnualEntitlement(
      fx.companyId,
      fx.employmentId,
      fx.annualTypeId,
      2026
    );
    expect(r.skipped).toBe(false);
    expect(Number(r.quantity)).toBeLessThan(21);
    expect(Number(r.quantity)).toBeGreaterThan(8);
  });

  it('accrual sync retry does not duplicate credits', async () => {
    const fx = await createLeaveFixture(prisma);
    await prisma.hcmLeavePolicy.update({
      where: { id: fx.policyId },
      data: { rules: { entitlementModel: 'MONTHLY_ACCRUAL', monthlyAccrualDays: 1.75 } },
    });
    const a = await runLeaveAccrualSync(fx.companyId, 2026, 6);
    const b = await runLeaveAccrualSync(fx.companyId, 2026, 6);
    expect(Boolean(b.duplicate) || a.id).toBeTruthy();
    const runs = await prisma.hcmLeaveAccrualRun.count({
      where: { companyId: fx.companyId, periodKey: 'accrual:2026-06' },
    });
    expect(runs).toBe(1);
  });

  it('adjustment idempotent sourceKey', async () => {
    const fx = await createLeaveFixture(prisma);
    const sk = `idem-adj:${fx.employmentId}`;
    await leaveLedgerService.postEntry({
      companyId: fx.companyId,
      employmentId: fx.employmentId,
      leaveTypeId: fx.annualTypeId,
      effectiveDate: new Date('2026-04-01'),
      quantity: new Decimal(1),
      transactionType: 'ADJUSTMENT_CREDIT',
      sourceKey: sk,
    });
    const again = await leaveLedgerService.postEntry({
      companyId: fx.companyId,
      employmentId: fx.employmentId,
      leaveTypeId: fx.annualTypeId,
      effectiveDate: new Date('2026-04-01'),
      quantity: new Decimal(1),
      transactionType: 'ADJUSTMENT_CREDIT',
      sourceKey: sk,
    });
    expect(again?.id).toBeTruthy();
    const n = await prisma.hcmLeaveLedgerEntry.count({ where: { companyId: fx.companyId, sourceKey: sk } });
    expect(n).toBe(1);
  });
});
