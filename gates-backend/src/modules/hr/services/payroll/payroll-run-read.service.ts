import prisma from '../../../../shared/database/prisma';
import { AppError } from '../../../../shared/middleware/error-handler';
import { roundTo4 } from '../../../../shared/utils/decimal-round';
import { payrollReconciliationService } from './payroll-reconciliation.service';
import { payrollGlMappingService } from './payroll-gl-mapping.service';

export type PayrollRunListQuery = {
  periodYear?: number;
  status?: string;
  calculationMode?: string;
  branchId?: string;
  page?: number;
  pageSize?: number;
};

function explainComponent(
  code: string,
  type: string,
  amount: number,
  explanation: unknown
): { title: string; detail: string; amount: number } {
  const exp = explanation as Record<string, unknown> | null;
  const detail =
    typeof exp?.reason === 'string'
      ? exp.reason
      : typeof exp?.memo === 'string'
        ? exp.memo
        : code;
  const titles: Record<string, string> = {
    BASIC: 'الراتب الأساسي',
    HOUSING: 'بدل السكن',
    TRANSPORT: 'بدل النقل',
    OVERTIME: 'عمل إضافي',
    BONUS: 'مكافأة',
    LATE: 'تأخير',
    EARLY_LEAVE: 'انصراف مبكر',
    ABSENCE: 'غياب',
    UNPAID_LEAVE: 'إجازة غير مدفوعة',
    ADVANCE_RECOVERY: 'استرداد سلفة',
    SOCIAL_INSURANCE_EE: 'تأمينات الموظف',
    SOCIAL_INSURANCE_ER: 'تأمينات صاحب العمل',
    TAX: 'ضريبة',
  };
  return {
    title: titles[code] ?? code,
    detail,
    amount,
  };
}

export class PayrollRunReadService {
  async listRuns(companyId: string, query: PayrollRunListQuery, includeAmounts: boolean) {
    const page = Math.max(1, query.page ?? 1);
    const pageSize = Math.min(100, Math.max(1, query.pageSize ?? 25));
    const where = {
      companyId,
      ...(query.periodYear ? { periodYear: query.periodYear } : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(query.calculationMode ? { calculationMode: query.calculationMode } : {}),
      ...(query.branchId ? { branchId: query.branchId } : {}),
    };
    const [rows, total] = await Promise.all([
      prisma.payrollRun.findMany({
        where,
        orderBy: [{ periodYear: 'desc' }, { periodMonth: 'desc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: { _count: { select: { items: true } } },
      }),
      prisma.payrollRun.count({ where }),
    ]);
    return {
      page,
      pageSize,
      total,
      rows: rows.map((r) => ({
        id: r.id,
        periodYear: r.periodYear,
        periodMonth: r.periodMonth,
        status: r.status,
        calculationMode: r.calculationMode,
        branchId: r.branchId,
        employeeCount: r._count.items,
        gross: includeAmounts ? Number(r.totalGross) : null,
        net: includeAmounts ? Number(r.totalNet) : null,
        employerContributions: includeAmounts ? Number(r.totalEmployerInsurance) : null,
        deductions: includeAmounts
          ? roundTo4(
              Number(r.totalEmployeeInsurance) +
                Number(r.totalTax) +
                Number(r.totalAdvanceDeduction)
            )
          : null,
        calculatedAt: r.calculatedAt,
        approvedAt: r.approvedAt,
        postedAt: r.postedAt,
        paidAt: r.paidAt,
      })),
    };
  }

  async getRunReview(companyId: string, runId: string, includeAmounts: boolean) {
    const run = await prisma.payrollRun.findFirst({
      where: { id: runId, companyId },
      include: {
        snapshot: true,
        items: {
          include: {
            employee: {
              select: {
                id: true,
                arabicName: true,
                serial: true,
                departmentId: true,
                costCenterId: true,
              },
            },
            components: { orderBy: [{ phase: 'asc' }, { componentCode: 'asc' }] },
          },
        },
      },
    });
    if (!run) throw new AppError(404, 'Payroll run not found');

    const recon = await payrollReconciliationService.reconcileRun(companyId, runId);
    const componentCodes = new Set<string>();
    for (const item of run.items) {
      for (const c of item.components) componentCodes.add(c.componentCode);
    }
    const glBlockers = await payrollGlMappingService.assertMappingsForRun(
      companyId,
      [...componentCodes]
    );

    const snap = run.snapshot?.inputSnapshot as {
      employees?: Record<string, { compensation?: { segments?: unknown[] } }>;
    } | null;

    const auditTimeline = [
      run.createdAt && {
        action: 'CREATED',
        at: run.createdAt,
        actorId: run.calculatedById,
      },
      run.calculatedAt && {
        action: 'CALCULATED',
        at: run.calculatedAt,
        actorId: run.calculatedById,
      },
      run.approvedAt && {
        action: 'APPROVED',
        at: run.approvedAt,
        actorId: run.approvedById,
      },
      run.postedAt && {
        action: 'POSTED',
        at: run.postedAt,
        actorId: run.postedById,
      },
      run.paidAt && { action: 'PAID', at: run.paidAt, actorId: null },
    ].filter(Boolean);

    return {
      run: {
        id: run.id,
        periodYear: run.periodYear,
        periodMonth: run.periodMonth,
        status: run.status,
        calculationMode: run.calculationMode,
        calculationJobId: run.calculationJobId,
        accrualJournalEntryId: run.accrualJournalEntryId,
        paymentJournalEntryId: run.paymentJournalEntryId,
        gross: includeAmounts ? Number(run.totalGross) : null,
        net: includeAmounts ? Number(run.totalNet) : null,
        employerContributions: includeAmounts ? Number(run.totalEmployerInsurance) : null,
        employeeCount: run.items.length,
        negativeNetOverrideReason: run.negativeNetOverrideReason,
      },
      reconciliation: recon,
      glBlockers,
      auditTimeline,
      employees: run.items.map((item) => ({
        employeeId: item.employeeId,
        name: item.employee.arabicName,
        serial: item.employee.serial,
        branchIdSnapshot: item.components[0]?.branchIdSnapshot ?? null,
        departmentIdSnapshot: item.components[0]?.departmentIdSnapshot ?? item.employee.departmentId,
        costCenterIdSnapshot: item.components[0]?.costCenterIdSnapshot ?? item.employee.costCenterId,
        gross: includeAmounts ? Number(item.grossSalary) : null,
        net: includeAmounts ? Number(item.netSalary) : null,
        compensationSegments:
          snap?.employees?.[item.employeeId]?.compensation?.segments ?? [],
        components: includeAmounts
          ? item.components.map((c) => ({
              code: c.componentCode,
              type: c.componentType,
              phase: c.phase,
              amount: Number(c.amount),
              quantity: c.quantity != null ? Number(c.quantity) : null,
              sourceRef: c.sourceRef,
              explanation: explainComponent(
                c.componentCode,
                c.componentType,
                Number(c.amount),
                c.explanation
              ),
              technical: {
                ruleCode: c.ruleCode,
                formulaFingerprint: c.ruleFormulaFingerprint,
              },
            }))
          : [],
      })),
    };
  }
}

export const payrollRunReadService = new PayrollRunReadService();
