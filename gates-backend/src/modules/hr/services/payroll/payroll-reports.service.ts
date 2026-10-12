import prisma from '../../../../shared/database/prisma';
import { roundTo4 } from '../../../../shared/utils/decimal-round';
import { payrollReconciliationService } from './payroll-reconciliation.service';

const TIME_DEDUCTION_CODES = new Set(['LATE', 'EARLY_LEAVE', 'ABSENCE', 'UNPAID_LEAVE']);

export type PayrollReportListQuery = {
  page?: number;
  pageSize?: number;
  employeeId?: string;
  componentCode?: string;
  branchId?: string;
  departmentId?: string;
  costCenterId?: string;
};

function paginateRows<T>(allRows: T[], opts?: { page?: number; pageSize?: number }) {
  const page = Math.max(1, opts?.page ?? 1);
  const pageSize = Math.min(200, Math.max(1, opts?.pageSize ?? 50));
  const slice = allRows.slice((page - 1) * pageSize, page * pageSize);
  return { page, pageSize, total: allRows.length, rows: slice };
}

function itemDimensionSnapshot(
  item: { components: Array<{ branchIdSnapshot?: string | null; departmentIdSnapshot?: string | null; costCenterIdSnapshot?: string | null }> },
  dimension: 'branch' | 'department' | 'costCenter'
) {
  const snap = item.components[0];
  if (dimension === 'branch') return snap?.branchIdSnapshot ?? null;
  if (dimension === 'department') return snap?.departmentIdSnapshot ?? null;
  return snap?.costCenterIdSnapshot ?? null;
}

function matchesRowFilters(
  item: { employeeId: string; components: Array<{ branchIdSnapshot?: string | null; departmentIdSnapshot?: string | null; costCenterIdSnapshot?: string | null }> },
  query?: PayrollReportListQuery
) {
  if (!query) return true;
  if (query.employeeId && item.employeeId !== query.employeeId) return false;
  if (query.branchId && itemDimensionSnapshot(item, 'branch') !== query.branchId) return false;
  if (query.departmentId && itemDimensionSnapshot(item, 'department') !== query.departmentId) return false;
  if (query.costCenterId && itemDimensionSnapshot(item, 'costCenter') !== query.costCenterId) return false;
  return true;
}

async function journalEntryTotals(companyId: string, journalEntryId: string | null | undefined) {
  if (!journalEntryId) return null;
  const je = await prisma.journalEntry.findFirst({
    where: { id: journalEntryId, companyId },
    select: { id: true, voucherNumber: true, legacyGlNum: true },
  });
  if (!je) return { journalEntryId, found: false as const, totalDebit: 0, totalCredit: 0, entryNumber: null };
  const agg = await prisma.journalEntryLine.aggregate({
    where: { journalEntryId },
    _sum: { debitBase: true, creditBase: true },
  });
  return {
    journalEntryId,
    found: true as const,
    entryNumber: je.voucherNumber ?? je.legacyGlNum,
    totalDebit: Number(agg._sum.debitBase ?? 0),
    totalCredit: Number(agg._sum.creditBase ?? 0),
  };
}

async function loadRun(companyId: string, payrollRunId: string) {
  return prisma.payrollRun.findFirst({
    where: { id: payrollRunId, companyId },
    include: {
      items: {
        include: {
          employee: { select: { id: true, arabicName: true, serial: true } },
          components: true,
        },
      },
    },
  });
}

export class PayrollReportsService {
  async payrollSummary(companyId: string, payrollRunId: string) {
    const run = await loadRun(companyId, payrollRunId);
    if (!run) return null;
    return {
      payrollRunId,
      periodYear: run.periodYear,
      periodMonth: run.periodMonth,
      status: run.status,
      totals: {
        gross: Number(run.totalGross),
        net: Number(run.totalNet),
        employerContributions: Number(run.totalEmployerInsurance),
        employeeInsurance: Number(run.totalEmployeeInsurance),
        tax: Number(run.totalTax),
        advanceDeduction: Number(run.totalAdvanceDeduction),
      },
      employeeCount: run.items.length,
    };
  }

  async payrollRegister(
    companyId: string,
    payrollRunId: string,
    opts?: PayrollReportListQuery
  ) {
    const run = await loadRun(companyId, payrollRunId);
    if (!run) return null;
    const filtered = run.items.filter((item) => matchesRowFilters(item, opts));
    const allRows = filtered.map((item) => ({
        employeeId: item.employeeId,
        employeeName: item.employee.arabicName,
        serial: item.employee.serial,
        grossSalary: Number(item.grossSalary),
        netSalary: Number(item.netSalary),
        components: item.components.map((c) => ({
          code: c.componentCode,
          type: c.componentType,
          amount: Number(c.amount),
        })),
      }));
    const pageInfo = paginateRows(allRows, opts);
    return {
      run: {
        id: run.id,
        periodYear: run.periodYear,
        periodMonth: run.periodMonth,
        status: run.status,
        calculationMode: run.calculationMode,
      },
      page: pageInfo.page,
      pageSize: pageInfo.pageSize,
      total: pageInfo.total,
      totals: {
        gross: Number(run.totalGross),
        net: Number(run.totalNet),
      },
      rows: pageInfo.rows,
    };
  }

  async deductionSummary(companyId: string, payrollRunId: string) {
    const run = await loadRun(companyId, payrollRunId);
    if (!run) return null;
    const rows: Array<{ code: string; total: number }> = [];
    const map = new Map<string, number>();
    for (const item of run.items) {
      for (const c of item.components) {
        if (c.componentType !== 'DEDUCTION') continue;
        map.set(c.componentCode, (map.get(c.componentCode) ?? 0) + Number(c.amount));
      }
    }
    for (const [code, total] of map) rows.push({ code, total: roundTo4(total) });
    return { payrollRunId, deductions: rows };
  }

  async overtimeReport(companyId: string, payrollRunId: string, opts?: PayrollReportListQuery) {
    const run = await loadRun(companyId, payrollRunId);
    if (!run) return null;
    const rows = [];
    for (const item of run.items) {
      if (!matchesRowFilters(item, opts)) continue;
      for (const c of item.components) {
        if (c.componentCode !== 'OVERTIME') continue;
        if (opts?.componentCode && opts.componentCode !== 'OVERTIME') continue;
        rows.push({
          employeeId: item.employeeId,
          employeeName: item.employee.arabicName,
          quantity: c.quantity != null ? Number(c.quantity) : null,
          amount: Number(c.amount),
        });
      }
    }
    const pageInfo = paginateRows(rows, opts);
    return {
      payrollRunId,
      ...pageInfo,
      totals: { amount: roundTo4(rows.reduce((s, r) => s + r.amount, 0)) },
    };
  }

  async absenceLeaveReport(companyId: string, payrollRunId: string, opts?: PayrollReportListQuery) {
    const run = await loadRun(companyId, payrollRunId);
    if (!run) return null;
    const rows = [];
    for (const item of run.items) {
      if (!matchesRowFilters(item, opts)) continue;
      for (const c of item.components) {
        if (!TIME_DEDUCTION_CODES.has(c.componentCode)) continue;
        if (opts?.componentCode && opts.componentCode !== c.componentCode) continue;
        rows.push({
          employeeId: item.employeeId,
          employeeName: item.employee.arabicName,
          code: c.componentCode,
          quantity: c.quantity != null ? Number(c.quantity) : null,
          amount: Number(c.amount),
        });
      }
    }
    const pageInfo = paginateRows(rows, opts);
    return {
      payrollRunId,
      ...pageInfo,
      totals: { amount: roundTo4(rows.reduce((s, r) => s + r.amount, 0)) },
    };
  }

  async advanceRecoveryReport(companyId: string, payrollRunId: string, opts?: PayrollReportListQuery) {
    const run = await loadRun(companyId, payrollRunId);
    if (!run) return null;
    const rows = [];
    for (const item of run.items) {
      if (!matchesRowFilters(item, opts)) continue;
      for (const c of item.components) {
        if (c.componentCode !== 'ADVANCE_RECOVERY') continue;
        rows.push({
          employeeId: item.employeeId,
          employeeName: item.employee.arabicName,
          advanceId: c.sourceRef,
          amount: Number(c.amount),
        });
      }
    }
    const pageInfo = paginateRows(rows, opts);
    return {
      payrollRunId,
      ...pageInfo,
      totals: { amount: roundTo4(rows.reduce((s, r) => s + r.amount, 0)) },
    };
  }

  async employerContributionReport(companyId: string, payrollRunId: string, opts?: PayrollReportListQuery) {
    const run = await loadRun(companyId, payrollRunId);
    if (!run) return null;
    const rows = [];
    for (const item of run.items) {
      if (!matchesRowFilters(item, opts)) continue;
      for (const c of item.components) {
        if (c.componentType !== 'EMPLOYER_CONTRIBUTION') continue;
        if (opts?.componentCode && opts.componentCode !== c.componentCode) continue;
        rows.push({
          employeeId: item.employeeId,
          employeeName: item.employee.arabicName,
          code: c.componentCode,
          amount: Number(c.amount),
        });
      }
    }
    const pageInfo = paginateRows(rows, opts);
    return {
      payrollRunId,
      ...pageInfo,
      totals: { amount: roundTo4(rows.reduce((s, r) => s + r.amount, 0)) },
    };
  }

  async byDimension(
    companyId: string,
    payrollRunId: string,
    dimension: 'branch' | 'department' | 'costCenter'
  ) {
    const run = await loadRun(companyId, payrollRunId);
    if (!run) return null;
    const map = new Map<string, { gross: number; net: number; count: number }>();
    for (const item of run.items) {
      const snap = item.components[0];
      const key =
        dimension === 'branch'
          ? snap?.branchIdSnapshot ?? 'UNASSIGNED'
          : dimension === 'department'
            ? snap?.departmentIdSnapshot ?? 'UNASSIGNED'
            : snap?.costCenterIdSnapshot ?? 'UNASSIGNED';
      const prev = map.get(key) ?? { gross: 0, net: 0, count: 0 };
      prev.gross += Number(item.grossSalary);
      prev.net += Number(item.netSalary);
      prev.count += 1;
      map.set(key, prev);
    }
    return {
      payrollRunId,
      dimension,
      rows: [...map.entries()].map(([id, v]) => ({
        dimensionId: id,
        employeeCount: v.count,
        gross: roundTo4(v.gross),
        net: roundTo4(v.net),
      })),
    };
  }

  async accountingReconciliation(companyId: string, payrollRunId: string) {
    const recon = await payrollReconciliationService.reconcileRun(companyId, payrollRunId);
    const run = await prisma.payrollRun.findFirst({
      where: { id: payrollRunId, companyId },
      select: {
        accrualJournalEntryId: true,
        paymentJournalEntryId: true,
        totalGross: true,
        totalNet: true,
        status: true,
      },
    });
    if (!run) return null;
    const [accrualJournal, paymentJournal] = await Promise.all([
      journalEntryTotals(companyId, run.accrualJournalEntryId),
      journalEntryTotals(companyId, run.paymentJournalEntryId),
    ]);
    const payrollNet = roundTo4(Number(run.totalNet));
    const journalDebitAccrual = accrualJournal?.totalDebit ?? 0;
    const differenceAccrual =
      accrualJournal?.found ? roundTo4(journalDebitAccrual - payrollNet) : null;
    const missingMappings = recon.blockers.filter((b) => b.startsWith('MISSING_GL_MAPPING'));
    const blockingExceptions = recon.blockers.filter((b) => !b.startsWith('MISSING_GL_MAPPING'));
    return {
      payrollRunId,
      runStatus: run.status,
      payrollTotals: {
        gross: roundTo4(Number(run.totalGross)),
        net: payrollNet,
      },
      reconciliation: recon,
      accrualJournalEntryId: run.accrualJournalEntryId,
      paymentJournalEntryId: run.paymentJournalEntryId,
      accrualJournal,
      paymentJournal,
      journalVsPayroll: {
        accrualDebitTotal: journalDebitAccrual,
        payrollNet,
        difference: differenceAccrual,
        balanced:
          differenceAccrual != null ? Math.abs(differenceAccrual) <= 0.5 && recon.balanced : recon.balanced,
      },
      missingMappings,
      blockingExceptions,
      reconciliationStatus:
        recon.balanced && blockingExceptions.length === 0
          ? missingMappings.length > 0
            ? 'WARN_MAPPINGS'
            : 'BALANCED'
          : 'EXCEPTION',
    };
  }

  async componentSummary(companyId: string, payrollRunId: string) {
    const run = await loadRun(companyId, payrollRunId);
    if (!run) return null;
    const byCode = new Map<string, { type: string; total: number }>();
    for (const item of run.items) {
      for (const c of item.components) {
        const prev = byCode.get(c.componentCode) ?? { type: c.componentType, total: 0 };
        prev.total += Number(c.amount);
        byCode.set(c.componentCode, prev);
      }
    }
    return {
      payrollRunId,
      components: [...byCode.entries()].map(([code, v]) => ({
        code,
        componentType: v.type,
        total: roundTo4(v.total),
      })),
    };
  }
}

export const payrollReportsService = new PayrollReportsService();
