import prisma from '../../../../shared/database/prisma';
import { roundTo4 } from '../../../../shared/utils/decimal-round';
import { payrollReconciliationService } from './payroll-reconciliation.service';

const TIME_DEDUCTION_CODES = new Set(['LATE', 'EARLY_LEAVE', 'ABSENCE', 'UNPAID_LEAVE']);

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
    opts?: { page?: number; pageSize?: number }
  ) {
    const run = await loadRun(companyId, payrollRunId);
    if (!run) return null;
    const page = Math.max(1, opts?.page ?? 1);
    const pageSize = Math.min(200, Math.max(1, opts?.pageSize ?? 50));
    const allRows = run.items.map((item) => ({
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
    const slice = allRows.slice((page - 1) * pageSize, page * pageSize);
    return {
      run: {
        id: run.id,
        periodYear: run.periodYear,
        periodMonth: run.periodMonth,
        status: run.status,
        calculationMode: run.calculationMode,
      },
      page,
      pageSize,
      total: allRows.length,
      totals: {
        gross: Number(run.totalGross),
        net: Number(run.totalNet),
      },
      rows: slice,
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

  async overtimeReport(companyId: string, payrollRunId: string) {
    const run = await loadRun(companyId, payrollRunId);
    if (!run) return null;
    const rows = [];
    for (const item of run.items) {
      for (const c of item.components) {
        if (c.componentCode !== 'OVERTIME') continue;
        rows.push({
          employeeId: item.employeeId,
          employeeName: item.employee.arabicName,
          quantity: c.quantity != null ? Number(c.quantity) : null,
          amount: Number(c.amount),
        });
      }
    }
    return { payrollRunId, rows };
  }

  async absenceLeaveReport(companyId: string, payrollRunId: string) {
    const run = await loadRun(companyId, payrollRunId);
    if (!run) return null;
    const rows = [];
    for (const item of run.items) {
      for (const c of item.components) {
        if (!TIME_DEDUCTION_CODES.has(c.componentCode)) continue;
        rows.push({
          employeeId: item.employeeId,
          employeeName: item.employee.arabicName,
          code: c.componentCode,
          quantity: c.quantity != null ? Number(c.quantity) : null,
          amount: Number(c.amount),
        });
      }
    }
    return { payrollRunId, rows };
  }

  async advanceRecoveryReport(companyId: string, payrollRunId: string) {
    const run = await loadRun(companyId, payrollRunId);
    if (!run) return null;
    const rows = [];
    for (const item of run.items) {
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
    return { payrollRunId, rows };
  }

  async employerContributionReport(companyId: string, payrollRunId: string) {
    const run = await loadRun(companyId, payrollRunId);
    if (!run) return null;
    const rows = [];
    for (const item of run.items) {
      for (const c of item.components) {
        if (c.componentType !== 'EMPLOYER_CONTRIBUTION') continue;
        rows.push({
          employeeId: item.employeeId,
          employeeName: item.employee.arabicName,
          code: c.componentCode,
          amount: Number(c.amount),
        });
      }
    }
    return { payrollRunId, rows };
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
      },
    });
    if (!run) return null;
    return {
      payrollRunId,
      reconciliation: recon,
      accrualJournalEntryId: run.accrualJournalEntryId,
      paymentJournalEntryId: run.paymentJournalEntryId,
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
