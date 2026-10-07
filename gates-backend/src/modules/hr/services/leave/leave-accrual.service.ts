import { Decimal } from '@prisma/client/runtime/library';
import prisma from '../../../../shared/database/prisma';
import { toDateOnly } from '../../utils/hr-effective-date.util';
import { leaveEnrollmentService } from './leave-enrollment.service';
import { leaveEntitlementService } from './leave-entitlement.service';
import { leaveLedgerService } from './leave-ledger.service';
import { DEFAULT_LEAVE_POLICY, type LeavePolicyRules } from './leave-policy.domain';

export class LeaveAccrualService {
  async runMonthlyAccrual(companyId: string, year: number, month: number) {
    const periodKey = `accrual:${year}-${String(month).padStart(2, '0')}`;
    const existing = await prisma.hcmLeaveAccrualRun.findFirst({
      where: { companyId, periodKey },
    });
    if (existing?.status === 'COMPLETED') {
      return { ...existing, duplicate: true };
    }

    const accrualDate = new Date(Date.UTC(year, month - 1, 1));
    const employments = await prisma.hcmEmployment.findMany({
      where: { companyId, status: 'ACTIVE' },
      select: { id: true, hireDate: true, terminationDate: true },
    });

    let processed = 0;
    let credited = 0;
    let skipped = 0;
    let failed = 0;

    const annualType = await prisma.hcmLeaveType.findFirst({
      where: { companyId, code: 'ANNUAL', isActive: true },
    });
    if (!annualType) {
      return prisma.hcmLeaveAccrualRun.create({
        data: {
          companyId,
          periodKey,
          status: 'COMPLETED',
          processed: 0,
          skipped: employments.length,
          details: { message: 'no_annual_leave_type' },
        },
      });
    }

    for (const emp of employments) {
      processed += 1;
      try {
        if (emp.terminationDate && toDateOnly(emp.terminationDate).getTime() < accrualDate.getTime()) {
          skipped += 1;
          continue;
        }
        const enrollment = await leaveEnrollmentService.resolvePolicyAt(companyId, emp.id, accrualDate);
        if (!enrollment) {
          skipped += 1;
          continue;
        }
        const rules = await leaveEntitlementService.resolveTypeRules(
          companyId,
          enrollment.policyId,
          annualType.id
        );
        if (rules.entitlementModel !== 'MONTHLY_ACCRUAL') {
          skipped += 1;
          continue;
        }
        const monthly = new Decimal(rules.monthlyAccrualDays ?? 1.75);
        const sourceKey = `accrual:${emp.id}:${annualType.id}:${periodKey}`;
        await leaveLedgerService.postEntry({
          companyId,
          employmentId: emp.id,
          leaveTypeId: annualType.id,
          effectiveDate: accrualDate,
          quantity: monthly,
          transactionType: 'ACCRUAL',
          sourceKey,
          reason: periodKey,
        });
        credited += 1;
      } catch {
        failed += 1;
      }
    }

    return prisma.hcmLeaveAccrualRun.upsert({
      where: { companyId_periodKey: { companyId, periodKey } },
      create: {
        companyId,
        periodKey,
        status: 'COMPLETED',
        processed,
        credited,
        skipped,
        failed,
      },
      update: { processed, credited, skipped, failed, status: 'COMPLETED' },
    });
  }

  async runCarryForward(companyId: string, employmentId: string, leaveTypeId: string, cycleEnd: Date) {
    const enrollment = await leaveEnrollmentService.resolvePolicyAt(companyId, employmentId, cycleEnd);
    if (!enrollment) return { skipped: true };
    const policyRules = (enrollment.policy.rules as LeavePolicyRules) ?? DEFAULT_LEAVE_POLICY;
    const maxCarry = policyRules.carryForwardMaxDays ?? 0;
    if (maxCarry <= 0) return { skipped: true, reason: 'no_carry' };
    const { leaveBalanceService } = await import('./leave-balance.service');
    const bal = await leaveBalanceService.getLeaveBalance(companyId, employmentId, leaveTypeId, cycleEnd);
    const available = new Decimal(bal.available);
    if (available.lte(0)) return { skipped: true };
    const carry = Decimal.min(available, new Decimal(maxCarry));
    const forfeit = available.minus(carry);
    const y = cycleEnd.getUTCFullYear();
    await leaveLedgerService.postEntry({
      companyId,
      employmentId,
      leaveTypeId,
      effectiveDate: cycleEnd,
      quantity: carry,
      transactionType: 'CARRY_FORWARD',
      sourceKey: `carry:${employmentId}:${leaveTypeId}:${y}`,
      reason: `Carry forward ${y}`,
    });
    if (forfeit.gt(0)) {
      await leaveLedgerService.postEntry({
        companyId,
        employmentId,
        leaveTypeId,
        effectiveDate: cycleEnd,
        quantity: forfeit,
        transactionType: 'FORFEITURE',
        sourceKey: `forfeit:${employmentId}:${leaveTypeId}:${y}`,
        reason: `Forfeiture above cap ${y}`,
      });
    }
    return { carry: carry.toString(), forfeit: forfeit.toString() };
  }
}

export const leaveAccrualService = new LeaveAccrualService();
