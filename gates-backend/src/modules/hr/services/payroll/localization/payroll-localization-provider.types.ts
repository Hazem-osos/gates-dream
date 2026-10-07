import type { PayrollEmployeeSnapshot } from '../payroll-calculation.types';

export type StatutoryBuildInput = {
  employee: PayrollEmployeeSnapshot;
  compensationByCode: Record<string, number>;
  periodStart: string;
  periodEnd: string;
};

export type PayrollLocalizationProvider = {
  countryCode: string;
  validateConfiguration(configKey: string, configJson: unknown): string[];
  buildStatutoryFacts(
    companyId: string,
    asOf: Date,
    input: StatutoryBuildInput
  ): Promise<Record<string, number>>;
  validateEmployeeStatutoryReadiness(input: StatutoryBuildInput): string[];
};
