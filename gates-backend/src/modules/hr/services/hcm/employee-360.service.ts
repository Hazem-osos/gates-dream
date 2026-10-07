import prisma from '../../../../shared/database/prisma';
import { AppError } from '../../../../shared/middleware/error-handler';
import { pickCurrentAssignment } from './employment-assignment.domain';
import { pickCurrentCompensation, pickCompensationAtDate } from './compensation-assignment.domain';
import { hcmTransitionService } from './hcm-transition.service';
import { hcmManagerService } from './hcm-manager.service';
import { hcmEmploymentEpisodeService } from './hcm-employment-episode.service';
import { toDateOnly } from '../../utils/hr-effective-date.util';
import { timePayrollReadService } from '../time/time-payroll-read.service';
import { leaveBalanceService } from '../leave/leave-balance.service';

export class Employee360Service {
  async getView(
    companyId: string,
    employeeId: string,
    options: {
      includeCompensation?: boolean;
      includePayrollAmounts?: boolean;
      attendancePeriodStart?: Date;
      attendancePeriodEnd?: Date;
    }
  ) {
    const employee = await prisma.employee.findFirst({
      where: { id: employeeId, companyId },
      include: {
        department: { select: { id: true, arabicName: true, unitType: true, managementId: true } },
        jobTitle: { select: { id: true, arabicName: true } },
        nationality: { select: { id: true, arabicName: true } },
      },
    });
    if (!employee) throw new AppError(404, 'Employee not found');

    const employmentEpisodes = await hcmEmploymentEpisodeService.listEpisodes(companyId, employeeId);
    const employment = await hcmEmploymentEpisodeService.getActiveEpisode(companyId, employeeId);

    const compensationHistory =
      employment && options.includeCompensation
        ? await prisma.hcmCompensationAssignment.findMany({
            where: { employmentId: employment.id, companyId },
            orderBy: { effectiveFrom: 'desc' },
            take: 20,
          })
        : [];

    let currentAssignment = null;
    let position = null;
    let managerPosition = null;
    let orgPath: Array<{ id: string; arabicName: string; unitType: string }> = [];

    if (employment) {
      const assignments = await prisma.hcmEmploymentAssignment.findMany({
        where: { employmentId: employment.id, companyId },
        orderBy: { effectiveFrom: 'desc' },
        take: 30,
      });
      currentAssignment = pickCurrentAssignment(assignments);
      if (currentAssignment?.positionId) {
        position = await prisma.hcmPosition.findFirst({
          where: { id: currentAssignment.positionId, companyId },
          include: {
            jobTitle: true,
            jobCadre: true,
            department: true,
            branch: true,
            reportsTo: { include: { assignments: { where: { effectiveTo: null }, take: 1 } } },
          },
        });
        if (position?.reportsTo) managerPosition = position.reportsTo;
      } else if (currentAssignment?.departmentId) {
        orgPath = await this.buildOrgPath(companyId, currentAssignment.departmentId);
      }
      if (currentAssignment?.managerPositionId) {
        managerPosition = await prisma.hcmPosition.findFirst({
          where: { id: currentAssignment.managerPositionId, companyId },
        });
      }
    }

    const currentCompensation =
      employment && options.includeCompensation
        ? pickCurrentCompensation(compensationHistory)
        : null;

    const manager = employment
      ? await hcmManagerService.resolveManagerForEmployee(companyId, employeeId)
      : null;

    const lifecycleEvents = employment
      ? await prisma.hcmEmploymentEvent.findMany({
          where: { companyId, employmentId: employment.id },
          orderBy: [{ effectiveDate: 'desc' }, { createdAt: 'desc' }],
          take: 50,
        })
      : [];

    const assignmentHistory = employment
      ? await prisma.hcmEmploymentAssignment.findMany({
          where: { employmentId: employment.id, companyId },
          orderBy: { effectiveFrom: 'desc' },
          take: 30,
        })
      : [];

    const [recentProcedures, openAdvances, lastPayrollItem, payrollHistory] = await Promise.all([
      prisma.employeeProcedure.findMany({
        where: { employeeId },
        orderBy: { date: 'desc' },
        take: 10,
      }),
      prisma.employeeAdvance.findMany({
        where: { employeeId, isActive: true, isSettled: false },
        take: 10,
      }),
      prisma.payrollRunItem.findFirst({
        where: { employeeId, payrollRun: { companyId, status: { in: ['POSTED', 'PAID', 'APPROVED', 'CALCULATED'] } } },
        orderBy: { createdAt: 'desc' },
        include: { payrollRun: { select: { periodYear: true, periodMonth: true, status: true } } },
      }),
      prisma.payrollRunItem.findMany({
        where: { employeeId, payrollRun: { companyId } },
        orderBy: { createdAt: 'desc' },
        take: 24,
        include: {
          payrollRun: { select: { id: true, periodYear: true, periodMonth: true, status: true, paidAt: true } },
        },
      }),
    ]);

    const attStart =
      options.attendancePeriodStart ??
      toDateOnly(new Date(new Date().getFullYear(), new Date().getMonth(), 1));
    const attEnd = options.attendancePeriodEnd ?? toDateOnly(new Date());
    const attendanceSummary =
      employment && options.includeCompensation
        ? await timePayrollReadService
            .summarizeEmployeePeriod(companyId, employment.id, attStart, attEnd)
            .catch(() => null)
        : null;
    const attendanceDays =
      employment && options.includeCompensation
        ? await prisma.hcmAttendanceDay.findMany({
            where: {
              companyId,
              employmentId: employment.id,
              logicalWorkDate: { gte: attStart, lte: attEnd },
            },
            orderBy: { logicalWorkDate: 'desc' },
            take: 62,
          })
        : undefined;

    const leaveTypes =
      employment
        ? await prisma.hcmLeaveType.findMany({
            where: { companyId, isActive: true },
            orderBy: { displayOrder: 'asc' },
          })
        : [];
    const leaveBalances =
      employment && leaveTypes.length
        ? await Promise.all(
            leaveTypes.map(async (lt) => {
              const b = await leaveBalanceService.getLeaveBalance(companyId, employment.id, lt.id, attEnd);
              return { ...b, leaveTypeCode: lt.code, leaveTypeName: lt.arabicName };
            })
          )
        : [];
    const leaveRequests =
      employment
        ? await prisma.hcmLeaveRequest.findMany({
            where: { companyId, employmentId: employment.id },
            orderBy: { createdAt: 'desc' },
            take: 20,
            include: { leaveType: true },
          })
        : [];

    return {
      profile: employee,
      employment,
      employmentEpisodes,
      currentAssignment,
      position,
      managerPosition,
      manager,
      orgPath,
      assignmentHistory,
      lifecycleEvents,
      currentCompensation: options.includeCompensation ? currentCompensation : undefined,
      compensationHistory: options.includeCompensation ? compensationHistory : undefined,
      contracts: employment?.contracts ?? [],
      recentProcedures,
      payroll: {
        lastPostedRunItem: options.includePayrollAmounts ? lastPayrollItem : null,
        history: payrollHistory.map((row) => ({
          payrollRunId: row.payrollRun.id,
          periodYear: row.payrollRun.periodYear,
          periodMonth: row.payrollRun.periodMonth,
          status: row.payrollRun.status,
          paidAt: row.payrollRun.paidAt,
          grossSalary: options.includePayrollAmounts ? Number(row.grossSalary) : null,
          netSalary: options.includePayrollAmounts ? Number(row.netSalary) : null,
        })),
        canonicalSource: 'PayrollRun',
        amountsRedacted: !options.includePayrollAmounts,
      },
      advances: { open: openAdvances },
      attendanceSummary,
      attendanceDays,
      leaveBalances,
      leaveRequests,
      modules: {
        attendance: { available: true, reason: 'hcm_time_engine' },
        leave: { available: true, reason: 'hcm_leave_engine' },
        documents: { available: false, reason: 'no_hr_document_model' },
        performance: { available: false, reason: 'not_implemented' },
        assets: { available: false, reason: 'not_implemented' },
      },
    };
  }

  async assignmentAt(companyId: string, employeeId: string, date: string) {
    const employment = await hcmEmploymentEpisodeService.getActiveEpisode(companyId, employeeId);
    if (!employment) throw new AppError(404, 'Employment not found');
    const at = toDateOnly(date);
    const assignment = await hcmTransitionService.getAssignmentAtDate(companyId, employment.id, at);
    const compensations = await prisma.hcmCompensationAssignment.findMany({
      where: { employmentId: employment.id, companyId },
    });
    const compensation = pickCompensationAtDate(compensations, at);
    return { assignment, compensation, employmentId: employment.id };
  }

  private async buildOrgPath(companyId: string, departmentId: string) {
    const path: Array<{ id: string; arabicName: string; unitType: string }> = [];
    let cursor: string | null = departmentId;
    const seen = new Set<string>();
    while (cursor && !seen.has(cursor)) {
      seen.add(cursor);
      const dept = await prisma.department.findFirst({
        where: { id: cursor, companyId },
        select: { id: true, arabicName: true, unitType: true, managementId: true },
      });
      if (!dept) break;
      path.unshift({ id: dept.id, arabicName: dept.arabicName, unitType: dept.unitType });
      cursor = dept.managementId;
    }
    return path;
  }
}

export const employee360Service = new Employee360Service();
