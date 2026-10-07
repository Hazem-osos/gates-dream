import prisma from '../../../../../shared/database/prisma';
import { roundTo4 } from '../../../../../shared/utils/decimal-round';
import { hrGlAccountResolverService } from '../../hr-gl-account-resolver.service';
import type { PayrollLocalizationProvider } from './payroll-localization-provider.types';

/** TEST-CONFIG ONLY — not legal advice or current Saudi law. */
export const saudiPayrollLocalizationProvider: PayrollLocalizationProvider = {
  countryCode: 'SA',

  validateConfiguration(configKey: string, configJson: unknown): string[] {
    if (configKey === 'GOSI_RATES' && typeof (configJson as { employeeRate?: unknown })?.employeeRate !== 'number') {
      return ['GOSI_RATES requires employeeRate'];
    }
    return [];
  },

  async buildStatutoryFacts(companyId, asOf, input) {
    const settings = await hrGlAccountResolverService.getSettings(companyId);
    const configs = await prisma.hcmPayrollLocalizationConfig.findMany({
      where: {
        companyId,
        countryCode: 'SA',
        isActive: true,
        effectiveFrom: { lte: asOf },
        OR: [{ effectiveTo: null }, { effectiveTo: { gte: asOf } }],
      },
    });

    let employeeRate = Number(settings.employeeInsuranceRate ?? 0);
    let employerRate = Number(settings.employerInsuranceRate ?? 0);
    for (const row of configs) {
      if (row.configKey === 'GOSI_RATES') {
        const j = row.configJson as { employeeRate?: number; employerRate?: number };
        if (j.employeeRate != null) employeeRate = j.employeeRate;
        if (j.employerRate != null) employerRate = j.employerRate;
      }
    }

    const base = roundTo4(
      Object.values(input.compensationByCode).reduce((s, v) => s + v, 0)
    );
    const facts: Record<string, number> = {
      statutory_employee_insurance_rate: employeeRate,
      statutory_employer_insurance_rate: employerRate,
      statutory_insurance_base: base,
    };
    if (input.employee.socialInsuranceEnrolled) {
      facts.statutory_employee_insurance_amount = roundTo4(base * employeeRate);
      facts.statutory_employer_insurance_amount = roundTo4(base * employerRate);
    }
    return facts;
  },

  validateEmployeeStatutoryReadiness() {
    return [];
  },
};
