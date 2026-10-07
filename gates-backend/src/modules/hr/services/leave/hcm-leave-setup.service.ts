import { Decimal } from '@prisma/client/runtime/library';
import prisma from '../../../../shared/database/prisma';
import { DEFAULT_LEAVE_POLICY } from './leave-policy.domain';
import { leaveEnrollmentService } from './leave-enrollment.service';
import { leaveEntitlementService } from './leave-entitlement.service';
import { leaveLedgerService } from './leave-ledger.service';

/** Idempotent company leave bootstrap for tests and onboarding. */
export class HcmLeaveSetupService {
  async ensureDefaultCatalog(companyId: string) {
    const annual = await prisma.hcmLeaveType.upsert({
      where: { companyId_code: { companyId, code: 'ANNUAL' } },
      create: {
        companyId,
        code: 'ANNUAL',
        arabicName: 'إجازة سنوية',
        englishName: 'Annual Leave',
        paidClassification: 'PAID',
        requiresBalance: true,
        attendanceClassification: 'PAID_LEAVE',
        displayOrder: 1,
      },
      update: {},
    });
    const sick = await prisma.hcmLeaveType.upsert({
      where: { companyId_code: { companyId, code: 'SICK' } },
      create: {
        companyId,
        code: 'SICK',
        arabicName: 'إجازة مرضية',
        englishName: 'Sick Leave',
        requiresBalance: false,
        attendanceClassification: 'SICK_LEAVE',
        displayOrder: 2,
      },
      update: {},
    });

    const policy = await prisma.hcmLeavePolicy.findFirst({
      where: { companyId, code: 'DEFAULT', effectiveFrom: new Date('2026-01-01') },
    });
    let policyId = policy?.id;
    if (!policyId) {
      const created = await prisma.hcmLeavePolicy.create({
        data: {
          companyId,
          code: 'DEFAULT',
          arabicName: 'سياسة افتراضية',
          effectiveFrom: new Date('2026-01-01'),
          rules: DEFAULT_LEAVE_POLICY,
        },
      });
      policyId = created.id;
    }

    await prisma.hcmLeavePolicyRule.upsert({
      where: { policyId_leaveTypeId: { policyId, leaveTypeId: annual.id } },
      create: {
        companyId,
        policyId,
        leaveTypeId: annual.id,
        rules: { entitlementDays: 21, entitlementModel: 'ANNUAL_GRANT' },
      },
      update: {},
    });

    return { annualTypeId: annual.id, sickTypeId: sick.id, policyId };
  }

  async enrollEmployment(companyId: string, employmentId: string, policyId: string, from: Date) {
    const existing = await prisma.hcmLeaveEnrollment.findFirst({
      where: { companyId, employmentId },
    });
    if (existing) return existing;
    return leaveEnrollmentService.assignEnrollment(companyId, {
      employmentId,
      policyId,
      effectiveFrom: from,
    });
  }

  async grantOpeningIfContractBalance(
    companyId: string,
    employmentId: string,
    leaveTypeId: string,
    employeeId: string
  ) {
    const contract = await prisma.employeeContract.findFirst({
      where: { employeeId, employmentId },
      orderBy: { contractStartDate: 'desc' },
    });
    const bal = contract?.leaveBalance;
    if (!bal || bal.lte(0)) return { skipped: true };
    const sourceKey = `migrated_opening:${employmentId}:${leaveTypeId}`;
    await leaveLedgerService.postEntry({
      companyId,
      employmentId,
      leaveTypeId,
      effectiveDate: new Date('2026-01-01'),
      quantity: new Decimal(bal),
      transactionType: 'MIGRATED_OPENING_BALANCE',
      sourceKey,
      reason: 'Migrated from EmployeeContract.leaveBalance',
    });
    return { skipped: false, quantity: bal.toString() };
  }

  async bootstrapEmployment(
    companyId: string,
    employmentId: string,
    employeeId: string,
    hireDate: Date
  ) {
    const catalog = await this.ensureDefaultCatalog(companyId);
    await this.enrollEmployment(companyId, employmentId, catalog.policyId, hireDate);
    await this.grantOpeningIfContractBalance(companyId, employmentId, catalog.annualTypeId, employeeId);
    const year = hireDate.getUTCFullYear();
    await leaveEntitlementService.grantAnnualEntitlement(
      companyId,
      employmentId,
      catalog.annualTypeId,
      year
    );
    return catalog;
  }
}

export const hcmLeaveSetupService = new HcmLeaveSetupService();
