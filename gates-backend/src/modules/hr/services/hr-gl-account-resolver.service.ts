import prisma from '../../../shared/database/prisma';
import { AppError } from '../../../shared/middleware/error-handler';
import { invoiceAccountResolverService } from '../../invoices/services/invoice-account-resolver.service';

const DEFAULTS = {
  salariesExpenseAccountCode: '6100',
  employerInsuranceExpenseAccountCode: '6110',
  socialInsurancePayableAccountCode: '2400',
  payrollTaxPayableAccountCode: '2410',
  employeeAdvancesAccountCode: '1420',
  accruedPayrollAccountCode: '2420',
};

export class HrGlAccountResolverService {
  async getSettings(companyId: string) {
    return prisma.hrSettings.upsert({
      where: { companyId },
      update: {},
      create: { companyId },
    });
  }

  async resolveAccounts(companyId: string) {
    const settings = await this.getSettings(companyId);
    const resolve = (code: string | null | undefined, fallback: string) =>
      invoiceAccountResolverService.resolveAccountId(
        companyId,
        (code && code.trim()) || fallback
      );

    return {
      settings,
      salariesExpenseAccountId: await resolve(
        settings.salariesExpenseAccountCode,
        DEFAULTS.salariesExpenseAccountCode
      ),
      employerInsuranceExpenseAccountId: await resolve(
        settings.employerInsuranceExpenseAccountCode,
        DEFAULTS.employerInsuranceExpenseAccountCode
      ),
      socialInsurancePayableAccountId: await resolve(
        settings.socialInsurancePayableAccountCode,
        DEFAULTS.socialInsurancePayableAccountCode
      ),
      payrollTaxPayableAccountId: await resolve(
        settings.payrollTaxPayableAccountCode,
        DEFAULTS.payrollTaxPayableAccountCode
      ),
      employeeAdvancesAccountId: await resolve(
        settings.employeeAdvancesAccountCode,
        DEFAULTS.employeeAdvancesAccountCode
      ),
      accruedPayrollAccountId: await resolve(
        settings.accruedPayrollAccountCode,
        DEFAULTS.accruedPayrollAccountCode
      ),
    };
  }
}

export const hrGlAccountResolverService = new HrGlAccountResolverService();
