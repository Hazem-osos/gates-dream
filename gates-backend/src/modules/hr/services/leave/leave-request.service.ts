import { Prisma } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import prisma from '../../../../shared/database/prisma';
import { AppError } from '../../../../shared/middleware/error-handler';
import { toDateOnly } from '../../utils/hr-effective-date.util';
import { hcmPayrollImpactService } from '../hcm/hcm-payroll-impact.service';
import { attendanceCalculationService } from '../time/attendance-calculation.service';
import { leaveLedgerService } from './leave-ledger.service';
import { leavePolicyGuardsService } from './leave-policy-guards.service';
import { leaveRequestCalculationService } from './leave-request-calculation.service';

export class LeaveRequestService {
  async assertNoOverlap(
    companyId: string,
    employmentId: string,
    startDate: Date,
    endDate: Date,
    excludeRequestId?: string
  ) {
    const start = toDateOnly(startDate);
    const end = toDateOnly(endDate);
    const conflict = await prisma.hcmLeaveRequest.findFirst({
      where: {
        companyId,
        employmentId,
        id: excludeRequestId ? { not: excludeRequestId } : undefined,
        status: { in: ['SUBMITTED', 'APPROVED'] },
        startDate: { lte: end },
        endDate: { gte: start },
      },
    });
    if (conflict) throw new AppError(409, 'Overlapping leave request');
  }

  async createDraft(
    companyId: string,
    input: {
      employmentId: string;
      employeeId: string;
      leaveTypeId: string;
      startDate: Date;
      endDate: Date;
      reason?: string;
      attachmentRef?: string;
      segmentType?: 'FULL' | 'HALF_AM' | 'HALF_PM' | 'HOURLY';
      hourlyStart?: Date;
      hourlyEnd?: Date;
      timezone?: string;
    }
  ) {
    const preview = await leaveRequestCalculationService.preview(
      companyId,
      input.employmentId,
      input.leaveTypeId,
      input.startDate,
      input.endDate,
      {
        segmentType: input.segmentType ?? 'FULL',
        hourlyStart: input.hourlyStart,
        hourlyEnd: input.hourlyEnd,
        timezone: input.timezone,
      }
    );
    const leaveType = await prisma.hcmLeaveType.findFirst({
      where: { id: input.leaveTypeId, companyId },
    });
    if (!leaveType) throw new AppError(404, 'Leave type not found');
    if (leaveType.requiresAttachment) {
      // attachment validated on submit
    }

    return prisma.hcmLeaveRequest.create({
      data: {
        companyId,
        employmentId: input.employmentId,
        employeeId: input.employeeId,
        leaveTypeId: input.leaveTypeId,
        status: 'DRAFT',
        startDate: toDateOnly(input.startDate),
        endDate: toDateOnly(input.endDate),
        requestedQuantity: new Decimal(preview.totalChargeableDays),
        calculatedQuantity: new Decimal(preview.totalChargeableDays),
        reason: input.reason,
        attachmentRef: input.attachmentRef,
        calculationDetail: preview,
      },
    });
  }

  async submit(companyId: string, requestId: string, userId: string) {
    return prisma.$transaction(
      async (tx) => {
        const req = await tx.hcmLeaveRequest.findFirst({
          where: { id: requestId, companyId },
          include: { leaveType: true },
        });
        if (!req) throw new AppError(404, 'Request not found');
        if (req.status !== 'DRAFT') throw new AppError(422, 'Invalid status');
        await leavePolicyGuardsService.assertRequestAllowed(
          companyId,
          req.employmentId,
          req.leaveTypeId,
          req.startDate,
          req.attachmentRef
        );
        await this.assertNoOverlap(companyId, req.employmentId, req.startDate, req.endDate, req.id);

        const qty = req.calculatedQuantity ?? req.requestedQuantity;
        if (req.leaveType.requiresBalance) {
          await tx.$executeRaw`SELECT id FROM hcm_employments WHERE id = ${req.employmentId} FOR UPDATE`;
          await this.assertBalanceForApproval(
            tx,
            companyId,
            req.employmentId,
            req.leaveTypeId,
            req.startDate,
            qty,
            req.id
          );
        }

        const impact = await hcmPayrollImpactService.detectImpactForEmployee(
          companyId,
          req.employeeId,
          req.startDate,
          req.endDate
        );

        return tx.hcmLeaveRequest.update({
          where: { id: req.id },
          data: {
            status: 'SUBMITTED',
            submittedAt: new Date(),
            submittedBy: userId,
            calculationDetail: {
              ...(req.calculationDetail as object),
              payrollImpact: impact,
            },
          },
        });
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
    );
  }

  private async assertBalanceForApproval(
    tx: Prisma.TransactionClient,
    companyId: string,
    employmentId: string,
    leaveTypeId: string,
    asOf: Date,
    qty: Decimal,
    excludeRequestId: string
  ) {
    const entries = await tx.hcmLeaveLedgerEntry.findMany({
      where: {
        companyId,
        employmentId,
        leaveTypeId,
        effectiveDate: { lte: asOf },
      },
    });
    let ledgerNet = new Decimal(0);
    for (const e of entries) {
      ledgerNet = ledgerNet.plus(leaveLedgerService.signedQuantity(e.transactionType as import('./leave-ledger.service').LedgerTransactionType, e.quantity));
    }
    const reservedRows = await tx.hcmLeaveRequest.findMany({
      where: {
        companyId,
        employmentId,
        leaveTypeId,
        id: { not: excludeRequestId },
        status: { in: ['SUBMITTED', 'APPROVED'] },
      },
      select: { id: true, calculatedQuantity: true, requestedQuantity: true },
    });
    let reserved = new Decimal(0);
    for (const r of reservedRows) {
      const taken = await tx.hcmLeaveLedgerEntry.count({
        where: { companyId, requestId: r.id, transactionType: 'LEAVE_TAKEN' },
      });
      if (taken > 0) continue;
      reserved = reserved.plus(r.calculatedQuantity ?? r.requestedQuantity);
    }
    const available = ledgerNet.minus(reserved);
    if (available.lt(qty)) throw new AppError(422, 'Insufficient balance');
  }

  async approve(companyId: string, requestId: string, userId: string) {
    return prisma.$transaction(
      async (tx) => {
      const req = await tx.hcmLeaveRequest.findFirst({
        where: { id: requestId, companyId },
        include: { leaveType: true },
      });
      if (!req) throw new AppError(404, 'Request not found');
      if (req.status !== 'SUBMITTED' && req.status !== 'DRAFT') {
        throw new AppError(422, 'Cannot approve');
      }

      const qty = req.calculatedQuantity ?? req.requestedQuantity;
      if (req.leaveType.requiresBalance) {
        await tx.$executeRaw`SELECT id FROM hcm_employments WHERE id = ${req.employmentId} FOR UPDATE`;
        await this.assertBalanceForApproval(
          tx,
          companyId,
          req.employmentId,
          req.leaveTypeId,
          req.startDate,
          qty,
          req.id
        );
      }

      const preview = await leaveRequestCalculationService.preview(
        companyId,
        req.employmentId,
        req.leaveTypeId,
        req.startDate,
        req.endDate
      );

      await tx.hcmLeaveRequestDay.deleteMany({ where: { requestId: req.id } });
      for (const d of preview.days) {
        if (d.excludedReason) continue;
        await tx.hcmLeaveRequestDay.create({
          data: {
            companyId,
            requestId: req.id,
            workDate: new Date(`${d.workDate}T00:00:00.000Z`),
            segmentType: d.segmentType,
            chargeableDays: new Decimal(d.chargeableDays),
            chargeableMinutes: d.chargeableMinutes,
            calendarDetail: d,
          },
        });
      }

      await leaveLedgerService.postEntry(
        {
          companyId,
          employmentId: req.employmentId,
          leaveTypeId: req.leaveTypeId,
          effectiveDate: req.startDate,
          quantity: qty,
          transactionType: 'LEAVE_TAKEN',
          sourceKey: `leave_taken:${req.id}`,
          requestId: req.id,
          reason: req.reason ?? 'Approved leave',
          createdBy: userId,
        },
        tx as typeof prisma
      );

      const updated = await tx.hcmLeaveRequest.update({
        where: { id: req.id },
        data: {
          status: 'APPROVED',
          approvedAt: new Date(),
          approvedBy: userId,
          calculatedQuantity: new Decimal(preview.totalChargeableDays),
          calculationDetail: preview,
        },
      });

      return updated;
    },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
    ).then(async (updated) => {
      await this.recalculateAffectedDays(companyId, updated.employmentId, updated.startDate, updated.endDate);
      return updated;
    });
  }

  async reject(companyId: string, requestId: string, userId: string, reason?: string) {
    const req = await prisma.hcmLeaveRequest.findFirst({ where: { id: requestId, companyId } });
    if (!req) throw new AppError(404, 'Request not found');
    if (req.status !== 'SUBMITTED') throw new AppError(422, 'Invalid status');
    return prisma.hcmLeaveRequest.update({
      where: { id: req.id },
      data: {
        status: 'REJECTED',
        rejectedAt: new Date(),
        rejectedBy: userId,
        rejectionReason: reason,
      },
    });
  }

  async cancelApproved(companyId: string, requestId: string, userId: string) {
    const req = await prisma.hcmLeaveRequest.findFirst({
      where: { id: requestId, companyId },
      include: { days: true },
    });
    if (!req) throw new AppError(404, 'Request not found');
    if (req.status !== 'APPROVED') throw new AppError(422, 'Not approved');

    const locked = await prisma.hcmAttendanceDay.findFirst({
      where: {
        companyId,
        employmentId: req.employmentId,
        logicalWorkDate: { gte: req.startDate, lte: req.endDate },
        status: 'LOCKED',
      },
    });
    if (locked) {
      throw new AppError(423, 'Locked time period — unlock before cancelling leave');
    }

    await prisma.$transaction(async (tx) => {
      await leaveLedgerService.postEntry(
        {
          companyId,
          employmentId: req.employmentId,
          leaveTypeId: req.leaveTypeId,
          effectiveDate: req.startDate,
          quantity: req.calculatedQuantity ?? req.requestedQuantity,
          transactionType: 'LEAVE_REVERSAL',
          sourceKey: `leave_reversal:${req.id}`,
          requestId: req.id,
          reason: 'Leave cancelled',
          createdBy: userId,
        },
        tx as typeof prisma
      );
      await tx.hcmLeaveRequest.update({
        where: { id: req.id },
        data: {
          status: 'CANCELLED',
          cancelledAt: new Date(),
          cancelledBy: userId,
        },
      });
    });

    await this.recalculateAffectedDays(companyId, req.employmentId, req.startDate, req.endDate);
    return { cancelled: true };
  }

  private async recalculateAffectedDays(
    companyId: string,
    employmentId: string,
    start: Date,
    end: Date
  ) {
    const employment = await prisma.hcmEmployment.findFirst({ where: { id: employmentId, companyId } });
    if (!employment) return;
    for (let cur = toDateOnly(start); cur.getTime() <= toDateOnly(end).getTime(); cur = new Date(cur.getTime() + 86400000)) {
      await attendanceCalculationService.recalculateDay(companyId, employmentId, cur, 'Africa/Cairo');
    }
  }
}

export const leaveRequestService = new LeaveRequestService();
