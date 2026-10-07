import { Decimal } from '@prisma/client/runtime/library';
import prisma from '../../../../shared/database/prisma';
import { leaveBalanceService } from './leave-balance.service';

export type LeaveReportFilters = {
  asOf?: Date;
  from?: Date;
  to?: Date;
  employmentId?: string;
  leaveTypeId?: string;
  branchId?: string;
  departmentId?: string;
  status?: string;
};

export class LeaveReportsService {
  async balanceReport(companyId: string, filters: LeaveReportFilters) {
    const asOf = filters.asOf ?? new Date();
    const types = await prisma.hcmLeaveType.findMany({
      where: { companyId, isActive: true, ...(filters.leaveTypeId ? { id: filters.leaveTypeId } : {}) },
    });
    const employments = await prisma.hcmEmployment.findMany({
      where: {
        companyId,
        status: 'ACTIVE',
        ...(filters.employmentId ? { id: filters.employmentId } : {}),
      },
      include: {
        employee: { select: { id: true, arabicName: true } },
        assignments: {
          where: { OR: [{ effectiveTo: null }, { effectiveTo: { gte: asOf } }] },
          take: 1,
        },
      },
      take: 1000,
    });
    const rows = [];
    for (const emp of employments) {
      const a = emp.assignments[0];
      if (filters.branchId && a?.branchId !== filters.branchId) continue;
      if (filters.departmentId && a?.departmentId !== filters.departmentId) continue;
      for (const lt of types) {
        const b = await leaveBalanceService.getLeaveBalance(companyId, emp.id, lt.id, asOf);
        rows.push({
          ...b,
          employeeId: emp.employeeId,
          employeeName: emp.employee.arabicName,
          leaveTypeCode: lt.code,
        });
      }
    }
    return rows;
  }

  async transactionsReport(companyId: string, filters: LeaveReportFilters) {
    return prisma.hcmLeaveLedgerEntry.findMany({
      where: {
        companyId,
        ...(filters.employmentId ? { employmentId: filters.employmentId } : {}),
        ...(filters.leaveTypeId ? { leaveTypeId: filters.leaveTypeId } : {}),
        ...(filters.from || filters.to
          ? {
              effectiveDate: {
                ...(filters.from ? { gte: filters.from } : {}),
                ...(filters.to ? { lte: filters.to } : {}),
              },
            }
          : {}),
      },
      orderBy: [{ effectiveDate: 'desc' }, { createdAt: 'desc' }],
      take: 2000,
      include: {
        leaveType: { select: { code: true, arabicName: true } },
        employment: { select: { employee: { select: { arabicName: true } } } },
        request: { select: { id: true, status: true } },
      },
    });
  }

  async takenReport(companyId: string, filters: LeaveReportFilters) {
    return prisma.hcmLeaveRequest.findMany({
      where: {
        companyId,
        status: 'APPROVED',
        ...(filters.employmentId ? { employmentId: filters.employmentId } : {}),
        ...(filters.leaveTypeId ? { leaveTypeId: filters.leaveTypeId } : {}),
        ...(filters.from || filters.to
          ? {
              startDate: { ...(filters.to ? { lte: filters.to } : {}) },
              endDate: { ...(filters.from ? { gte: filters.from } : {}) },
            }
          : {}),
      },
      include: { leaveType: true, employee: { select: { arabicName: true } } },
      take: 500,
    });
  }

  async pendingRequestsReport(companyId: string, filters: LeaveReportFilters) {
    return prisma.hcmLeaveRequest.findMany({
      where: {
        companyId,
        status: filters.status ?? 'SUBMITTED',
        ...(filters.employmentId ? { employmentId: filters.employmentId } : {}),
        ...(filters.leaveTypeId ? { leaveTypeId: filters.leaveTypeId } : {}),
      },
      include: { leaveType: true, employee: { select: { arabicName: true } } },
      orderBy: { submittedAt: 'asc' },
      take: 500,
    });
  }

  async expiringLeaveReport(companyId: string, asOf: Date) {
    const types = await prisma.hcmLeaveType.findMany({ where: { companyId, isActive: true, requiresBalance: true } });
    const employments = await prisma.hcmEmployment.findMany({
      where: { companyId, status: 'ACTIVE' },
      select: { id: true, employeeId: true, employee: { select: { arabicName: true } } },
      take: 500,
    });
    const rows = [];
    for (const emp of employments) {
      for (const lt of types) {
        const bal = await leaveBalanceService.getLeaveBalance(companyId, emp.id, lt.id, asOf);
        const avail = new Decimal(bal.available);
        if (avail.lte(0)) continue;
        rows.push({
          employmentId: emp.id,
          employeeName: emp.employee.arabicName,
          leaveTypeCode: lt.code,
          available: bal.available,
          carriedForward: bal.carriedForward,
          asOfDate: bal.asOfDate,
        });
      }
    }
    return rows;
  }

  async liabilityFactsReport(companyId: string, asOf: Date) {
    const balances = await this.balanceReport(companyId, { asOf });
    return balances.map((b) => ({
      employmentId: b.employmentId,
      employeeName: (b as { employeeName?: string }).employeeName,
      leaveTypeCode: (b as { leaveTypeCode?: string }).leaveTypeCode,
      asOfDate: b.asOfDate,
      availableQuantity: b.available,
      eligibleForEncashmentQuantity: b.available,
      ledgerNet: b.ledgerNet,
      unit: b.unit,
    }));
  }

  async absenceLeaveSummary(companyId: string, from: Date, to: Date, employmentId?: string) {
    const days = await prisma.hcmAttendanceDay.findMany({
      where: {
        companyId,
        ...(employmentId ? { employmentId } : {}),
        logicalWorkDate: { gte: from, lte: to },
      },
      select: {
        employmentId: true,
        employeeId: true,
        logicalWorkDate: true,
        absenceMinutes: true,
        paidLeaveMinutes: true,
        unpaidLeaveMinutes: true,
        sickLeaveMinutes: true,
        otherApprovedLeaveMinutes: true,
        workedMinutes: true,
      },
      take: 5000,
    });
    const byEmp = new Map<string, typeof days>();
    for (const d of days) {
      const list = byEmp.get(d.employmentId) ?? [];
      list.push(d);
      byEmp.set(d.employmentId, list);
    }
    return Array.from(byEmp.entries()).map(([employmentId, list]) => ({
      employmentId,
      days: list.length,
      absenceMinutes: list.reduce((s, x) => s + x.absenceMinutes, 0),
      paidLeaveMinutes: list.reduce((s, x) => s + x.paidLeaveMinutes, 0),
      unpaidLeaveMinutes: list.reduce((s, x) => s + x.unpaidLeaveMinutes, 0),
      sickLeaveMinutes: list.reduce((s, x) => s + x.sickLeaveMinutes, 0),
      workedMinutes: list.reduce((s, x) => s + x.workedMinutes, 0),
    }));
  }
}

export const leaveReportsService = new LeaveReportsService();
