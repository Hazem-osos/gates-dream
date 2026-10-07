import prisma from '../../../../shared/database/prisma';
import { roundTo4 } from '../../../../shared/utils/decimal-round';
import { payrollGlMappingService } from './payroll-gl-mapping.service';

export type PayrollReconciliation = {
  grossFromComponents: number;
  deductionsFromComponents: number;
  employerFromComponents: number;
  netFromComponents: number;
  headerGross: number;
  headerNet: number;
  balanced: boolean;
  blockers: string[];
};

export class PayrollReconciliationService {
  async reconcileRun(companyId: string, payrollRunId: string): Promise<PayrollReconciliation> {
    const run = await prisma.payrollRun.findFirst({
      where: { id: payrollRunId, companyId },
      include: { items: { include: { components: true } } },
    });
    const blockers: string[] = [];
    if (!run) {
      return {
        grossFromComponents: 0,
        deductionsFromComponents: 0,
        employerFromComponents: 0,
        netFromComponents: 0,
        headerGross: 0,
        headerNet: 0,
        balanced: false,
        blockers: ['RUN_NOT_FOUND'],
      };
    }

    let gross = 0;
    let deductions = 0;
    let employer = 0;
    for (const item of run.items) {
      for (const c of item.components) {
        const amt = Number(c.amount);
        if (c.componentType === 'EARNING') gross += amt;
        if (c.componentType === 'DEDUCTION') deductions += amt;
        if (c.componentType === 'EMPLOYER_CONTRIBUTION') employer += amt;
        if (!c.glAccountId && c.componentType !== 'EMPLOYER_CONTRIBUTION') {
          // GL optional until mapped — warn only for earnings/deductions without fallback
        }
      }
      if (item.components.length === 0) {
        gross += Number(item.grossSalary);
        deductions +=
          Number(item.employeeInsurance) +
          Number(item.tax) +
          Number(item.advanceDeduction) +
          Number(item.absenceDeduction) +
          Number(item.otherDeductions);
      }
    }

    gross = roundTo4(gross);
    deductions = roundTo4(deductions);
    employer = roundTo4(employer);
    const netFromComponents = roundTo4(gross - deductions);
    const headerGross = roundTo4(Number(run.totalGross));
    const headerNet = roundTo4(Number(run.totalNet));

    const hasComponents = run.items.some((i) => i.components.length > 0);
    if (hasComponents) {
      if (Math.abs(headerGross - gross) > 0.5) blockers.push('GROSS_MISMATCH');
      if (Math.abs(headerNet - netFromComponents) > 0.5) blockers.push('NET_MISMATCH');
      const codes = new Set<string>();
      for (const item of run.items) {
        for (const c of item.components) codes.add(c.componentCode);
      }
      blockers.push(...(await payrollGlMappingService.assertMappingsForRun(companyId, [...codes])));
    }

    return {
      grossFromComponents: gross,
      deductionsFromComponents: deductions,
      employerFromComponents: employer,
      netFromComponents,
      headerGross,
      headerNet,
      balanced: blockers.length === 0,
      blockers,
    };
  }
}

export const payrollReconciliationService = new PayrollReconciliationService();
