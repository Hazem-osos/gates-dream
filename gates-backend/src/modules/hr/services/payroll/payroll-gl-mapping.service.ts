import { createHash } from 'crypto';
import prisma from '../../../../shared/database/prisma';
import { AppError } from '../../../../shared/middleware/error-handler';
import { hrGlAccountResolverService } from '../hr-gl-account-resolver.service';

export type ComponentGlMapping = {
  componentCode: string;
  componentType: string;
  expenseAccountId?: string;
  payableAccountId?: string;
};

const CODE_PAYABLE_FALLBACK: Record<string, keyof Awaited<ReturnType<typeof hrGlAccountResolverService.resolveAccounts>>> = {
  TAX: 'payrollTaxPayableAccountId',
  SOCIAL_INSURANCE_EE: 'socialInsurancePayableAccountId',
  ADVANCE_RECOVERY: 'employeeAdvancesAccountId',
  SOCIAL_INSURANCE_ER: 'socialInsurancePayableAccountId',
};

export class PayrollGlMappingService {
  async fingerprintMappings(companyId: string): Promise<string> {
    const map = await this.resolveComponentMappings(companyId);
    const payload = [...map.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([code, m]) => [code, m.expenseAccountId, m.payableAccountId]);
    return createHash('sha256').update(JSON.stringify(payload)).digest('hex').slice(0, 32);
  }

  async resolveComponentMappings(companyId: string): Promise<Map<string, ComponentGlMapping>> {
    const [components, accounts] = await Promise.all([
      prisma.hcmPayComponent.findMany({ where: { companyId, isActive: true } }),
      hrGlAccountResolverService.resolveAccounts(companyId),
    ]);

    const map = new Map<string, ComponentGlMapping>();
    for (const c of components) {
      const expense =
        c.glExpenseAccountId ??
        (c.componentType === 'EARNING' || c.componentType === 'EMPLOYER_CONTRIBUTION'
          ? c.componentType === 'EMPLOYER_CONTRIBUTION'
            ? accounts.employerInsuranceExpenseAccountId
            : accounts.salariesExpenseAccountId
          : undefined);
      const payableKey = CODE_PAYABLE_FALLBACK[c.code];
      const payableFromKey =
        payableKey && payableKey in accounts
          ? (accounts as unknown as Record<string, string | undefined>)[payableKey]
          : undefined;
      const payable =
        c.glPayableAccountId ??
        (payableFromKey ??
          (c.componentType === 'DEDUCTION' ? accounts.accruedPayrollAccountId : undefined));

      map.set(c.code, {
        componentCode: c.code,
        componentType: c.componentType,
        expenseAccountId: expense ?? undefined,
        payableAccountId: payable ?? undefined,
      });
    }
    return map;
  }

  async assertMappingsForRun(companyId: string, componentCodes: string[]): Promise<string[]> {
    const map = await this.resolveComponentMappings(companyId);
    const blockers: string[] = [];
    for (const code of componentCodes) {
      const m = map.get(code);
      if (!m) {
        blockers.push(`MISSING_GL_MAPPING:${code}`);
        continue;
      }
      if (m.componentType === 'EARNING' && !m.expenseAccountId) {
        blockers.push(`MISSING_GL_MAPPING:${code}:expense`);
      }
      if (m.componentType === 'EMPLOYER_CONTRIBUTION' && !m.expenseAccountId) {
        blockers.push(`MISSING_GL_MAPPING:${code}:employer_expense`);
      }
      if (m.componentType === 'DEDUCTION' && !m.payableAccountId && code !== 'ADVANCE_RECOVERY') {
        blockers.push(`MISSING_GL_MAPPING:${code}:payable`);
      }
    }
    return blockers;
  }

  async updateComponentGlAccounts(
    companyId: string,
    payComponentId: string,
    data: { glExpenseAccountId?: string | null; glPayableAccountId?: string | null }
  ) {
    const row = await prisma.hcmPayComponent.findFirst({
      where: { id: payComponentId },
      select: { id: true, companyId: true },
    });
    if (!row || row.companyId !== companyId) {
      throw new AppError(404, 'Pay component not found');
    }
    if (data.glExpenseAccountId) {
      const acct = await prisma.account.findFirst({
        where: { id: data.glExpenseAccountId, companyId, deletedAt: null },
      });
      if (!acct) throw new AppError(422, 'GL expense account not in company');
    }
    if (data.glPayableAccountId) {
      const acct = await prisma.account.findFirst({
        where: { id: data.glPayableAccountId, companyId, deletedAt: null },
      });
      if (!acct) throw new AppError(422, 'GL payable account not in company');
    }
    return prisma.hcmPayComponent.update({
      where: { id: payComponentId },
      data: {
        glExpenseAccountId: data.glExpenseAccountId,
        glPayableAccountId: data.glPayableAccountId,
      },
    });
  }

  resolveAccountForComponent(
    mapping: ComponentGlMapping,
    amount: number
  ): { debitAccountId?: string; creditAccountId?: string } {
    if (amount === 0) return {};
    if (mapping.componentType === 'EARNING') {
      return { debitAccountId: mapping.expenseAccountId, creditAccountId: undefined };
    }
    if (mapping.componentType === 'EMPLOYER_CONTRIBUTION') {
      return { debitAccountId: mapping.expenseAccountId, creditAccountId: mapping.payableAccountId };
    }
    return { debitAccountId: undefined, creditAccountId: mapping.payableAccountId };
  }
}

export const payrollGlMappingService = new PayrollGlMappingService();
