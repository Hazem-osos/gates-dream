import prisma from '../../../../shared/database/prisma';
import { AppError } from '../../../../shared/middleware/error-handler';
import { timePayrollReadService } from '../time/time-payroll-read.service';
import type {
  PayrollCalculationContext,
  PayrollEmployeeSnapshot,
  PayrollPeriodFacts,
} from './payroll-calculation.types';
import { payrollLocalizationService } from './payroll-localization.service';
import {
  buildCompensationSegments,
  sumSegmentsByCode,
  type ProrationMethod,
} from './payroll-proration.domain';
import {
  resolveBillableDeductionMinutes,
  validateDeductionMinuteInvariants,
} from './payroll-deduction-minutes.domain';

function periodBounds(year: number, month: number): PayrollPeriodFacts {
  const start = new Date(Date.UTC(year, month - 1, 1));
  const end = new Date(Date.UTC(year, month, 0));
  const startStr = start.toISOString().slice(0, 10);
  const endStr = end.toISOString().slice(0, 10);
  const calendarDays = end.getUTCDate();
  return { year, month, start: startStr, end: endStr, calendarDays };
}

export class PayrollContextBuilderService {
  async buildEmployeeContext(
    companyId: string,
    employeeId: string,
    periodYear: number,
    periodMonth: number,
    options?: { requireTimeReady?: boolean }
  ): Promise<PayrollCalculationContext> {
    const period = periodBounds(periodYear, periodMonth);

    const employee = await prisma.employee.findFirst({
      where: { id: employeeId, companyId },
      include: {
        hcmEmployments: {
          where: { status: 'ACTIVE' },
          orderBy: { hireDate: 'desc' },
          take: 1,
          include: {
            assignments: {
              orderBy: { effectiveFrom: 'desc' },
              take: 1,
            },
          },
        },
      },
    });
    if (!employee) throw new AppError(404, 'Employee not found');

    const employment = employee.hcmEmployments[0];
    const employmentId = employment?.id ?? `legacy-${employeeId}`;

    const asOf = new Date(`${period.end}T12:00:00.000Z`);
    const compTimeline = employment
      ? await prisma.hcmCompensationAssignment.findFirst({
      where: {
        companyId,
        employmentId: employment.id,
        effectiveFrom: { lte: asOf },
        OR: [{ effectiveTo: null }, { effectiveTo: { gte: asOf } }],
      },
      orderBy: { effectiveFrom: 'desc' },
    })
      : null;
    const periodEndDate = new Date(`${period.end}T12:00:00.000Z`);
    const componentRows = employment
      ? await prisma.hcmCompensationComponentAssignment.findMany({
      where: {
        companyId,
        employmentId: employment.id,
        effectiveFrom: { lte: periodEndDate },
        OR: [{ effectiveTo: null }, { effectiveTo: { gte: new Date(`${period.start}T12:00:00.000Z`) } }],
      },
      include: { payComponent: { select: { code: true } } },
    })
      : [];

    const hrSettings = await prisma.hrSettings.findUnique({ where: { companyId } });
    const prorationMethod = (hrSettings?.payrollProrationMethod ?? 'CALENDAR_DAYS') as ProrationMethod;

    const compInputs = componentRows.map((row) => ({
      code: row.payComponent.code,
      amount: Number(row.amount),
      effectiveFrom: row.effectiveFrom.toISOString().slice(0, 10),
      effectiveTo: row.effectiveTo?.toISOString().slice(0, 10) ?? null,
    }));

    if (compInputs.length === 0 && compTimeline) {
      compInputs.push({
        code: 'BASIC',
        amount: Number(compTimeline.basicSalary),
        effectiveFrom: compTimeline.effectiveFrom.toISOString().slice(0, 10),
        effectiveTo: compTimeline.effectiveTo?.toISOString().slice(0, 10) ?? null,
      });
      if (Number(compTimeline.fixedAllowances ?? 0) > 0) {
        compInputs.push({
          code: 'FIXED_ALLOWANCES',
          amount: Number(compTimeline.fixedAllowances),
          effectiveFrom: compTimeline.effectiveFrom.toISOString().slice(0, 10),
          effectiveTo: compTimeline.effectiveTo?.toISOString().slice(0, 10) ?? null,
        });
      }
    }
    if (compInputs.length === 0) {
      compInputs.push({
        code: 'BASIC',
        amount: Number(employee.basicSalary ?? 0),
        effectiveFrom: period.start,
        effectiveTo: null,
      });
    }

    const segments = buildCompensationSegments({
      periodStart: period.start,
      periodEnd: period.end,
      method: prorationMethod,
      employmentStart: employment?.hireDate?.toISOString().slice(0, 10) ?? employee.joinDate?.toISOString().slice(0, 10) ?? null,
      employmentEnd: employment?.terminationDate?.toISOString().slice(0, 10) ?? null,
      components: compInputs,
    });
    const byCode = sumSegmentsByCode(segments);

    const assignment = employment?.assignments?.[0];
    const empSnap: PayrollEmployeeSnapshot = {
      employeeId,
      employmentId,
      branchId: assignment?.branchId ?? null,
      departmentId: assignment?.departmentId ?? employee.departmentId,
      costCenterId: employee.costCenterId,
      countryCode: 'EG',
      socialInsuranceEnrolled: employee.socialInsuranceEnrolled,
      taxExemptionAmount: Number(employee.taxExemptionAmount ?? 0),
    };

    const timeSummary = employment
      ? await timePayrollReadService.summarizeEmployeePeriod(
          companyId,
          employment.id,
          new Date(`${period.start}T12:00:00.000Z`),
          new Date(`${period.end}T12:00:00.000Z`)
        )
      : {
          employeeId,
          employmentId,
          periodStart: period.start,
          periodEnd: period.end,
          scheduledMinutes: 0,
          workedMinutes: 0,
          lateMinutes: 0,
          earlyLeaveMinutes: 0,
          absenceMinutes: 0,
          detectedOvertimeMinutes: 0,
          approvedOvertimeMinutes: 0,
          paidLeaveMinutes: 0,
          unpaidLeaveMinutes: 0,
          sickLeaveMinutes: 0,
          otherApprovedLeaveMinutes: 0,
          restDayWorkMinutes: 0,
          holidayWorkMinutes: 0,
          unresolvedExceptionCount: 0,
          lockedDayCount: 0,
          readyForPayroll: true,
        };

    if (options?.requireTimeReady && !timeSummary.readyForPayroll) {
      throw new AppError(
        422,
        `Time period not ready for payroll for employee ${employeeId}`
      );
    }

    const approvedInputs = await prisma.hcmPayrollOneTimeInput.findMany({
      where: {
        companyId,
        employeeId,
        status: 'APPROVED',
        consumedRunId: null,
        OR: [
          { periodYear, periodMonth },
          { periodYear: 0, periodMonth: 0 },
        ],
      },
      include: { payComponent: { select: { code: true } } },
    });
    const oneTimeInputIds = approvedInputs.map((r) => r.id);
    const inputs: Record<string, number> = {};
    for (const row of approvedInputs) {
      inputs[row.payComponent.code] =
        (inputs[row.payComponent.code] ?? 0) + Number(row.amount);
    }

    const advances = await this.computeAdvanceDue(employeeId);
    const statutory = await payrollLocalizationService.buildStatutoryFacts(
      companyId,
      empSnap.countryCode,
      asOf,
      {
        employee: empSnap,
        compensation: { byCode },
        periodStart: period.start,
        periodEnd: period.end,
      }
    );

    const deductionFacts = {
      lateMinutes: timeSummary.lateMinutes,
      earlyLeaveMinutes: timeSummary.earlyLeaveMinutes,
      absenceMinutes: timeSummary.absenceMinutes,
      unpaidLeaveMinutes: timeSummary.unpaidLeaveMinutes,
    };
    const minuteBlockers = validateDeductionMinuteInvariants(deductionFacts);
    if (minuteBlockers.length) {
      throw new AppError(422, minuteBlockers.join('; '));
    }
    const billable = resolveBillableDeductionMinutes(deductionFacts);

    const timeFacts = {
      scheduledMinutes: timeSummary.scheduledMinutes,
      workedMinutes: timeSummary.workedMinutes,
      lateMinutes: timeSummary.lateMinutes,
      earlyLeaveMinutes: timeSummary.earlyLeaveMinutes,
      absenceMinutes: timeSummary.absenceMinutes,
      approvedOvertimeMinutes: timeSummary.approvedOvertimeMinutes,
      paidLeaveMinutes: timeSummary.paidLeaveMinutes,
      unpaidLeaveMinutes: timeSummary.unpaidLeaveMinutes,
      sickLeaveMinutes: timeSummary.sickLeaveMinutes,
      otherApprovedLeaveMinutes: timeSummary.otherApprovedLeaveMinutes,
      readyForPayroll: timeSummary.readyForPayroll,
      unresolvedExceptionCount: timeSummary.unresolvedExceptionCount,
      lateBillableMinutes: billable.lateBillableMinutes,
      earlyLeaveBillableMinutes: billable.earlyLeaveBillableMinutes,
      absenceBillableMinutes: billable.absenceBillableMinutes,
      unpaidLeaveBillableMinutes: billable.unpaidLeaveMinutes,
    };

    const vars: Record<string, number> = {
      period_days: period.calendarDays,
      comp_basic: byCode.BASIC ?? 0,
      comp_fixed_allowances: byCode.FIXED_ALLOWANCES ?? 0,
      time_scheduled_minutes: timeFacts.scheduledMinutes > 0 ? timeFacts.scheduledMinutes : 1,
      time_worked_minutes: timeFacts.workedMinutes,
      time_late_minutes: timeFacts.lateMinutes,
      time_early_leave_minutes: timeFacts.earlyLeaveMinutes,
      time_late_billable_minutes: billable.lateBillableMinutes,
      time_early_leave_billable_minutes: billable.earlyLeaveBillableMinutes,
      time_absence_billable_minutes: billable.absenceBillableMinutes,
      leave_unpaid_minutes: billable.unpaidLeaveMinutes,
      time_absence_minutes: timeFacts.absenceMinutes,
      time_approved_overtime_minutes: timeFacts.approvedOvertimeMinutes,
      leave_paid_minutes: timeFacts.paidLeaveMinutes,
      leave_sick_minutes: timeFacts.sickLeaveMinutes,
      advance_due: advances.dueAmount,
      tax_exemption: empSnap.taxExemptionAmount,
    };
    for (const [code, amt] of Object.entries(byCode)) {
      vars[`comp_${code.toLowerCase()}`] = amt;
    }
    for (const [code, amt] of Object.entries(inputs)) {
      vars[`input_${code.toLowerCase()}`] = amt;
    }
    for (const [k, v] of Object.entries(statutory)) {
      vars[k] = v;
    }

    return {
      period,
      employee: empSnap,
      compensation: {
        byCode,
        currencyCode: compTimeline?.currencyCode ?? 'EGP',
        segments,
      },
      time: timeFacts,
      leave: timeFacts,
      advances,
      inputs,
      oneTimeInputIds,
      statutory,
      vars,
    };
  }

  private async computeAdvanceDue(employeeId: string) {
    const advances = await prisma.employeeAdvance.findMany({
      where: { employeeId, isActive: true, isSettled: false },
      orderBy: { date: 'asc' },
    });
    let dueAmount = 0;
    const lines: Array<{ advanceId: string; amount: number }> = [];
    for (const adv of advances) {
      const remaining = Number(adv.remainingAmount ?? adv.value);
      if (remaining <= 0) continue;
      const installment = Number(adv.monthlyInstallment ?? remaining);
      const take = Math.min(installment, remaining);
      dueAmount += take;
      lines.push({ advanceId: adv.id, amount: take });
    }
    return { dueAmount, lines };
  }
}

export const payrollContextBuilderService = new PayrollContextBuilderService();
