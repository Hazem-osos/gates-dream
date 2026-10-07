import prisma from '../../../../../shared/database/prisma';
import { roundTo4 } from '../../../../../shared/utils/decimal-round';
import { hrGlAccountResolverService } from '../../hr-gl-account-resolver.service';
import type { PayrollLocalizationProvider } from './payroll-localization-provider.types';

/** TEST-CONFIG ONLY — not legal advice or current Egyptian law. */
export const egyptPayrollLocalizationProvider: PayrollLocalizationProvider = {
  countryCode: 'EG',

  validateConfiguration(configKey: string, configJson: unknown): string[] {
    const errors: string[] = [];
    if (configKey === 'TAX_BRACKETS' && !Array.isArray((configJson as { brackets?: unknown })?.brackets)) {
      errors.push('TAX_BRACKETS requires brackets array');
    }
    if (configKey === 'INSURANCE_CAP' && typeof (configJson as { maxBase?: unknown })?.maxBase !== 'number') {
      errors.push('INSURANCE_CAP requires maxBase number');
    }
    return errors;
  },

  async buildStatutoryFacts(companyId, asOf, input) {
    const settings = await hrGlAccountResolverService.getSettings(companyId);
    const configs = await prisma.hcmPayrollLocalizationConfig.findMany({
      where: {
        companyId,
        countryCode: 'EG',
        isActive: true,
        effectiveFrom: { lte: asOf },
        OR: [{ effectiveTo: null }, { effectiveTo: { gte: asOf } }],
      },
    });

    const facts: Record<string, number> = {
      statutory_employee_insurance_rate: Number(settings.employeeInsuranceRate ?? 0),
      statutory_employer_insurance_rate: Number(settings.employerInsuranceRate ?? 0),
      statutory_tax_flat_rate: Number(settings.payrollTaxFlatRate ?? 0),
    };

    let insuranceCap = 0;
    let taxFromBrackets = 0;
    const taxableBase = Object.values(input.compensationByCode).reduce((s, v) => s + v, 0);

    for (const row of configs) {
      const json = row.configJson as Record<string, unknown>;
      if (row.configKey === 'INSURANCE_CAP' && typeof json.maxBase === 'number') {
        insuranceCap = json.maxBase;
        facts.statutory_insurance_cap = insuranceCap;
      }
      if (row.configKey === 'TAX_BRACKETS' && Array.isArray(json.brackets)) {
        let remaining = taxableBase;
        for (const b of json.brackets as Array<{ upTo?: number; rate: number }>) {
          const slice = b.upTo != null ? Math.min(remaining, b.upTo) : remaining;
          taxFromBrackets += slice * b.rate;
          remaining -= slice;
          if (remaining <= 0) break;
        }
        facts.statutory_tax_bracket_amount = roundTo4(taxFromBrackets);
      }
    }

    let insuranceBase = roundTo4(taxableBase);
    if (insuranceCap > 0) insuranceBase = Math.min(insuranceBase, insuranceCap);
    facts.statutory_insurance_base = insuranceBase;
    if (input.employee.socialInsuranceEnrolled) {
      facts.statutory_employee_insurance_amount = roundTo4(
        insuranceBase * facts.statutory_employee_insurance_rate
      );
      facts.statutory_employer_insurance_amount = roundTo4(
        insuranceBase * facts.statutory_employer_insurance_rate
      );
    }
    return facts;
  },

  validateEmployeeStatutoryReadiness() {
    return [];
  },
};
