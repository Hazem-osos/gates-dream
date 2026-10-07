import { PrismaClient } from '@prisma/client';
import type { PayrollFixture } from './hcm-payroll-fixture';
import {
  componentAmounts,
  seedPayrollAttendance,
  type AttendanceSeed,
} from './hcm-payroll-wave-a.fixture';
import { payrollContextBuilderService } from '../../modules/hr/services/payroll/payroll-context-builder.service';
import { payrollRunCalculationService } from '../../modules/hr/services/payroll/payroll-run-calculation.service';
import { billablePayrollTimeMinutes } from '../../modules/hr/services/payroll/payroll-billable-time.domain';

export type Matrix18Row = {
  name: string;
  month: number;
  days: AttendanceSeed[];
  expectMoney: (m: Map<string, number>) => void;
};

export const PAYROLL_MATRIX_18: Matrix18Row[] = [
  {
    name: '1 normal worked period',
    month: 1,
    days: [{ logicalWorkDate: '2026-01-15', workedMinutes: 480, scheduledMinutes: 480 }],
    expectMoney: (m) => expect(m.get('BASIC')).toBeGreaterThan(0),
  },
  {
    name: '2 approved overtime',
    month: 2,
    days: [{ logicalWorkDate: '2026-02-10', approvedOvertimeMinutes: 120, workedMinutes: 600 }],
    expectMoney: (m) => expect(m.get('OVERTIME') ?? 0).toBeGreaterThan(0),
  },
  {
    name: '3 late',
    month: 3,
    days: [{ logicalWorkDate: '2026-03-10', lateMinutes: 45, workedMinutes: 435 }],
    expectMoney: (m) => expect(m.get('LATE') ?? 0).toBeGreaterThan(0),
  },
  {
    name: '4 early leave',
    month: 4,
    days: [{ logicalWorkDate: '2026-04-10', earlyLeaveMinutes: 60, workedMinutes: 420 }],
    expectMoney: (m) => expect(m.get('EARLY_LEAVE') ?? 0).toBeGreaterThan(0),
  },
  {
    name: '5 unexplained absence',
    month: 5,
    days: [{ logicalWorkDate: '2026-05-10', absenceMinutes: 480, workedMinutes: 0 }],
    expectMoney: (m) => expect(m.get('ABSENCE') ?? 0).toBeGreaterThan(0),
  },
  {
    name: '6 paid leave',
    month: 6,
    days: [{ logicalWorkDate: '2026-06-10', paidLeaveMinutes: 480, workedMinutes: 0 }],
    expectMoney: (m) => expect(m.get('BASIC')).toBeGreaterThan(0),
  },
  {
    name: '7 unpaid leave',
    month: 7,
    days: [{ logicalWorkDate: '2026-07-10', unpaidLeaveMinutes: 240, workedMinutes: 240 }],
    expectMoney: (m) => expect(m.get('UNPAID_LEAVE') ?? 0).toBeGreaterThan(0),
  },
  {
    name: '8 sick leave',
    month: 8,
    days: [{ logicalWorkDate: '2026-08-10', sickLeaveMinutes: 480, workedMinutes: 0 }],
    expectMoney: (m) => expect(m.get('BASIC')).toBeGreaterThan(0),
  },
  {
    name: '9 half-day paid leave',
    month: 9,
    days: [{ logicalWorkDate: '2026-09-08', paidLeaveMinutes: 240, workedMinutes: 240 }],
    expectMoney: (m) => expect(m.get('BASIC')).toBeGreaterThan(0),
  },
  {
    name: '10 half-day unpaid leave',
    month: 10,
    days: [
      {
        logicalWorkDate: '2026-10-08',
        unpaidLeaveMinutes: 240,
        workedMinutes: 240,
        scheduledMinutes: 480,
      },
    ],
    expectMoney: (m) => expect(m.get('UNPAID_LEAVE') ?? 0).toBeGreaterThan(0),
  },
  {
    name: '11 hourly paid leave',
    month: 11,
    days: [{ logicalWorkDate: '2026-11-08', paidLeaveMinutes: 60, workedMinutes: 420 }],
    expectMoney: (m) => expect(m.get('BASIC')).toBeGreaterThan(0),
  },
  {
    name: '12 hourly unpaid leave',
    month: 12,
    days: [{ logicalWorkDate: '2026-12-08', unpaidLeaveMinutes: 60, workedMinutes: 420 }],
    expectMoney: (m) => expect(m.get('UNPAID_LEAVE') ?? 0).toBeGreaterThan(0),
  },
  {
    name: '13 partial leave + worked time',
    month: 1,
    days: [{ logicalWorkDate: '2026-01-20', paidLeaveMinutes: 120, workedMinutes: 360 }],
    expectMoney: (m) => expect(m.get('BASIC')).toBeGreaterThan(0),
  },
  {
    name: '14 leave overlapping apparent early departure',
    month: 2,
    days: [
      {
        logicalWorkDate: '2026-02-20',
        unpaidLeaveMinutes: 120,
        earlyLeaveMinutes: 120,
        workedMinutes: 360,
      },
    ],
    expectMoney: (m) => {
      expect(m.get('UNPAID_LEAVE') ?? 0).toBeGreaterThan(0);
      expect(m.get('EARLY_LEAVE') ?? 0).toBe(0);
    },
  },
  {
    name: '15 leave overlapping apparent absence',
    month: 3,
    days: [
      {
        logicalWorkDate: '2026-03-20',
        unpaidLeaveMinutes: 180,
        absenceMinutes: 180,
        workedMinutes: 300,
      },
    ],
    expectMoney: (m) => {
      expect(m.get('UNPAID_LEAVE') ?? 0).toBeGreaterThan(0);
      expect(m.get('ABSENCE') ?? 0).toBe(0);
    },
  },
  {
    name: '16 leave + late',
    month: 4,
    days: [
      {
        logicalWorkDate: '2026-04-20',
        unpaidLeaveMinutes: 60,
        lateMinutes: 30,
        workedMinutes: 390,
      },
    ],
    expectMoney: (m) => {
      expect(m.get('UNPAID_LEAVE') ?? 0).toBeGreaterThan(0);
      expect(m.get('LATE') ?? 0).toBe(0);
    },
  },
  {
    name: '17 leave + approved overtime',
    month: 5,
    days: [
      {
        logicalWorkDate: '2026-05-20',
        paidLeaveMinutes: 120,
        approvedOvertimeMinutes: 60,
        workedMinutes: 420,
      },
    ],
    expectMoney: (m) => expect(m.get('OVERTIME') ?? 0).toBeGreaterThan(0),
  },
  {
    name: '18 overnight/rest/holiday interaction',
    month: 6,
    days: [
      {
        logicalWorkDate: '2026-06-20',
        dayClassification: 'HOLIDAY',
        workedMinutes: 240,
        scheduledMinutes: 0,
      },
    ],
    expectMoney: (m) => expect(m.get('BASIC')).toBeGreaterThan(0),
  },
];

export async function runPayrollMonth(
  prisma: PrismaClient,
  fx: PayrollFixture,
  month: number,
  days?: AttendanceSeed[]
) {
  if (days?.length) await seedPayrollAttendance(prisma, fx, days);
  return payrollRunCalculationService.createPayrollRun(fx.companyId, {
    periodYear: 2026,
    periodMonth: month,
    branchId: fx.branchId,
    fiscalYearId: fx.fiscalYearId,
  });
}

export async function assertMatrixCase(
  prisma: PrismaClient,
  fx: PayrollFixture,
  row: Matrix18Row
) {
  const run = await runPayrollMonth(prisma, fx, row.month, row.days);
  const built = await payrollContextBuilderService.buildEmployeeContext(
    fx.companyId,
    fx.employeeId,
    2026,
    row.month
  );
  const t = built.time;
  const seeded = row.days[0];
  if (seeded.scheduledMinutes != null) expect(t.scheduledMinutes).toBe(seeded.scheduledMinutes);
  if (seeded.workedMinutes != null) expect(t.workedMinutes).toBe(seeded.workedMinutes);
  if (seeded.paidLeaveMinutes != null) expect(t.paidLeaveMinutes).toBe(seeded.paidLeaveMinutes);
  if (seeded.unpaidLeaveMinutes != null) expect(t.unpaidLeaveMinutes).toBe(seeded.unpaidLeaveMinutes);
  if (seeded.absenceMinutes != null) expect(t.absenceMinutes).toBe(seeded.absenceMinutes);
  if (seeded.lateMinutes != null) expect(t.lateMinutes).toBe(seeded.lateMinutes);
  if (seeded.earlyLeaveMinutes != null) expect(t.earlyLeaveMinutes).toBe(seeded.earlyLeaveMinutes);
  if (seeded.approvedOvertimeMinutes != null) {
    expect(t.approvedOvertimeMinutes).toBe(seeded.approvedOvertimeMinutes);
  }

  const billable = billablePayrollTimeMinutes({
    lateMinutes: t.lateMinutes,
    earlyLeaveMinutes: t.earlyLeaveMinutes,
    absenceMinutes: t.absenceMinutes,
    unpaidLeaveMinutes: t.unpaidLeaveMinutes,
  });
  const billableTotal =
    billable.lateBillableMinutes +
    billable.earlyLeaveBillableMinutes +
    billable.absenceBillableMinutes +
    t.unpaidLeaveMinutes;
  const rawPenalty =
    t.lateMinutes + t.earlyLeaveMinutes + t.absenceMinutes + t.unpaidLeaveMinutes;
  expect(billableTotal).toBeLessThanOrEqual(rawPenalty + 1);

  const map = await componentAmounts(prisma, run.id, fx.employeeId);
  row.expectMoney(map);
  return run;
}
