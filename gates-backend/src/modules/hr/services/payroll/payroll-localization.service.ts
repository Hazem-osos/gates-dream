import prisma from '../../../../shared/database/prisma';
import { getPayrollLocalizationProvider } from './localization/payroll-localization-registry';
import type { PayrollEmployeeSnapshot } from './payroll-calculation.types';

type StatutoryInput = {
  employee: PayrollEmployeeSnapshot;
  compensation: { byCode: Record<string, number> };
  periodStart: string;
  periodEnd: string;
};

export class PayrollLocalizationService {
  async buildStatutoryFacts(
    companyId: string,
    countryCode: string,
    asOf: Date,
    input: StatutoryInput
  ): Promise<Record<string, number>> {
    const provider = getPayrollLocalizationProvider(countryCode);
    if (!provider) return {};
    return provider.buildStatutoryFacts(companyId, asOf, {
      employee: input.employee,
      compensationByCode: input.compensation.byCode,
      periodStart: input.periodStart,
      periodEnd: input.periodEnd,
    });
  }

  async validateConfig(
    companyId: string,
    countryCode: string,
    configKey: string,
    configJson: unknown
  ): Promise<string[]> {
    const provider = getPayrollLocalizationProvider(countryCode);
    if (!provider) return [`Unsupported country ${countryCode}`];
    const local = provider.validateConfiguration(configKey, configJson);
    if (local.length) return local;
    return [];
  }

  async validateEmployeeReadiness(
    countryCode: string,
    input: StatutoryInput
  ): Promise<string[]> {
    const provider = getPayrollLocalizationProvider(countryCode);
    if (!provider) return [];
    return provider.validateEmployeeStatutoryReadiness({
      employee: input.employee,
      compensationByCode: input.compensation.byCode,
      periodStart: input.periodStart,
      periodEnd: input.periodEnd,
    });
  }

  async listConfigs(companyId: string, countryCode?: string) {
    return prisma.hcmPayrollLocalizationConfig.findMany({
      where: { companyId, ...(countryCode ? { countryCode } : {}) },
      orderBy: [{ countryCode: 'asc' }, { configKey: 'asc' }, { effectiveFrom: 'desc' }],
    });
  }
}

export const payrollLocalizationService = new PayrollLocalizationService();
