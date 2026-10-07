import prisma from '../../../../shared/database/prisma';
import { roundTo4 } from '../../../../shared/utils/decimal-round';
import { hrGlAccountResolverService } from '../hr-gl-account-resolver.service';
import { payrollGlMappingService } from './payroll-gl-mapping.service';

export type AggregatedJournalLine = {
  accountId: string;
  costCenterId?: string | null;
  debit: number;
  credit: number;
  memo: string;
};

export class PayrollComponentJournalService {
  async buildAccrualLines(companyId: string, payrollRunId: string): Promise<AggregatedJournalLine[]> {
    const run = await prisma.payrollRun.findFirst({
      where: { id: payrollRunId, companyId },
      include: {
        snapshot: true,
        items: { include: { components: true } },
      },
    });
    if (!run) throw new Error('Payroll run not found');

    const accounts = await hrGlAccountResolverService.resolveAccounts(companyId);
    const glMap = await payrollGlMappingService.resolveComponentMappings(companyId);
    const agg = new Map<string, AggregatedJournalLine>();

    const snapEmployees = (run.snapshot?.inputSnapshot as { employees?: Record<string, { employee?: { branchId?: string; departmentId?: string; costCenterId?: string } }> })?.employees ?? {};

    for (const item of run.items) {
      const empSnap = snapEmployees[item.employeeId]?.employee;
      for (const comp of item.components) {
        const amount = roundTo4(Number(comp.amount));
        if (amount === 0) continue;
        const costCenterId = comp.costCenterIdSnapshot ?? empSnap?.costCenterId ?? null;
        const mapping =
          glMap.get(comp.componentCode) ?? {
            componentCode: comp.componentCode,
            componentType: comp.componentType,
            expenseAccountId: comp.glExpenseAccountIdSnapshot ?? undefined,
            payableAccountId: comp.glPayableAccountIdSnapshot ?? undefined,
          };

        if (comp.componentType === 'EARNING') {
          const accountId = mapping.expenseAccountId ?? accounts.salariesExpenseAccountId;
          this.add(agg, accountId, costCenterId, amount, 0, comp.componentCode);
        } else if (comp.componentType === 'EMPLOYER_CONTRIBUTION') {
          const exp = mapping.expenseAccountId ?? accounts.employerInsuranceExpenseAccountId;
          const pay = mapping.payableAccountId ?? accounts.socialInsurancePayableAccountId;
          this.add(agg, exp, costCenterId, amount, 0, `${comp.componentCode}:exp`);
          this.add(agg, pay, costCenterId, 0, amount, `${comp.componentCode}:pay`);
        } else if (comp.componentType === 'DEDUCTION') {
          const pay = mapping.payableAccountId ?? accounts.accruedPayrollAccountId;
          this.add(agg, pay, costCenterId, 0, amount, comp.componentCode);
        }
      }
    }

    const net = roundTo4(Number(run.totalNet));
    this.add(agg, accounts.accruedPayrollAccountId, null, 0, net, 'NET_PAYABLE');

    return [...agg.values()].filter((l) => l.debit > 0 || l.credit > 0);
  }

  private add(
    agg: Map<string, AggregatedJournalLine>,
    accountId: string,
    costCenterId: string | null | undefined,
    debit: number,
    credit: number,
    memo: string
  ) {
    const key = `${accountId}|${costCenterId ?? ''}|${memo}`;
    const existing = agg.get(key);
    if (existing) {
      existing.debit = roundTo4(existing.debit + debit);
      existing.credit = roundTo4(existing.credit + credit);
      return;
    }
    agg.set(key, { accountId, costCenterId: costCenterId ?? null, debit, credit, memo });
  }
}

export const payrollComponentJournalService = new PayrollComponentJournalService();
