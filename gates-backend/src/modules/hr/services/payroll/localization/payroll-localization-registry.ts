import type { PayrollLocalizationProvider } from './payroll-localization-provider.types';
import { egyptPayrollLocalizationProvider } from './egypt-payroll-localization.provider';
import { saudiPayrollLocalizationProvider } from './saudi-payroll-localization.provider';

const providers = new Map<string, PayrollLocalizationProvider>([
  ['EG', egyptPayrollLocalizationProvider],
  ['SA', saudiPayrollLocalizationProvider],
]);

export function getPayrollLocalizationProvider(countryCode: string): PayrollLocalizationProvider | null {
  return providers.get(countryCode.toUpperCase()) ?? null;
}

export function listPayrollLocalizationProviders(): PayrollLocalizationProvider[] {
  return [...providers.values()];
}
