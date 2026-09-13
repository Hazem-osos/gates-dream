import { companySettingsService } from '../../company/services/company-settings.service';
import { logger } from '../../../shared/logger';
import type { HrPayrollSettingsInput } from '../schemas/hr-settings.schema';

const HR_ADVANCED_KEY = 'hrPayroll';

function asRecord(v: unknown): Record<string, unknown> {
  if (v && typeof v === 'object' && !Array.isArray(v)) {
    return { ...(v as Record<string, unknown>) };
  }
  return {};
}

export class HrSettingsService {
  async getHrPayrollSettings(companyId: string): Promise<HrPayrollSettingsInput> {
    const row = await companySettingsService.getCompanySettings(companyId);
    const adv = asRecord(row.advancedSettings);
    const blob = adv[HR_ADVANCED_KEY];
    return asRecord(blob) as HrPayrollSettingsInput;
  }

  async saveHrPayrollSettings(
    companyId: string,
    payload: HrPayrollSettingsInput
  ): Promise<HrPayrollSettingsInput> {
    const row = await companySettingsService.getCompanySettings(companyId);
    const adv = asRecord(row.advancedSettings);
    const prev = asRecord(adv[HR_ADVANCED_KEY]);
    const merged = { ...prev, ...payload };
    adv[HR_ADVANCED_KEY] = merged;

    await companySettingsService.updateCompanySettings(companyId, {
      advancedSettings: adv as Record<string, unknown>,
    });

    logger.info({ companyId }, 'HR payroll settings saved under advancedSettings.hrPayroll');
    return merged as HrPayrollSettingsInput;
  }
}

export const hrSettingsService = new HrSettingsService();
