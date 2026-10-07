import prisma from '../../../../shared/database/prisma';
import { leaveBalanceService } from './leave-balance.service';
import { leaveRequestCalculationService } from './leave-request-calculation.service';

export class LeaveInboxService {
  async listInbox(companyId: string, status = 'SUBMITTED') {
    const requests = await prisma.hcmLeaveRequest.findMany({
      where: { companyId, status },
      orderBy: { submittedAt: 'asc' },
      take: 200,
      include: {
        leaveType: true,
        employee: { select: { id: true, arabicName: true, serial: true } },
        employment: {
          select: {
            id: true,
            episodeNumber: true,
            hireDate: true,
            status: true,
            assignments: {
              where: { OR: [{ effectiveTo: null }, { effectiveTo: { gte: new Date() } }] },
              take: 1,
              include: { department: true, branch: true },
            },
          },
        },
      },
    });

    const rows = [];
    for (const r of requests) {
      const bal = await leaveBalanceService.getLeaveBalance(
        companyId,
        r.employmentId,
        r.leaveTypeId,
        r.startDate
      );
      const qty = r.calculatedQuantity ?? r.requestedQuantity;
      const projected = bal.available;
      const deptId = r.employment.assignments[0]?.departmentId;
      const teamOverlap = deptId
        ? await prisma.hcmLeaveRequestDay.count({
            where: {
              companyId,
              workDate: { gte: r.startDate, lte: r.endDate },
              request: {
                status: 'APPROVED',
                employmentId: { not: r.employmentId },
                employment: { assignments: { some: { departmentId: deptId } } },
              },
            },
          })
        : 0;
      rows.push({
        ...r,
        chargeableQuantity: qty.toString(),
        balance: bal,
        projectedAvailable: projected,
        teamOverlapCount: teamOverlap,
        policyWarnings: [],
        attachmentIndicator: Boolean(r.attachmentRef),
      });
    }
    return rows;
  }

  async previewForRequest(companyId: string, requestId: string) {
    const r = await prisma.hcmLeaveRequest.findFirst({
      where: { id: requestId, companyId },
    });
    if (!r) return null;
    return leaveRequestCalculationService.preview(
      companyId,
      r.employmentId,
      r.leaveTypeId,
      r.startDate,
      r.endDate
    );
  }
}

export const leaveInboxService = new LeaveInboxService();
