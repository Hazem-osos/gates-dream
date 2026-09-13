import { companySettingsService } from '../../company/services/company-settings.service';
import { logger } from '../../../shared/logger';
import type { SchoolSettingsInput } from '../schemas/school-settings.schema';

const SCHOOL_ADVANCED_KEY = 'schoolSettings';

function asRecord(v: unknown): Record<string, unknown> {
  if (v && typeof v === 'object' && !Array.isArray(v)) {
    return { ...(v as Record<string, unknown>) };
  }
  return {};
}

export class SchoolSettingsService {
  async getSchoolSettings(companyId: string): Promise<SchoolSettingsInput> {
    const row = await companySettingsService.getCompanySettings(companyId);
    const adv = asRecord(row.advancedSettings);
    const blob = adv[SCHOOL_ADVANCED_KEY];
    return asRecord(blob) as SchoolSettingsInput;
  }

  async saveSchoolSettings(companyId: string, payload: SchoolSettingsInput): Promise<SchoolSettingsInput> {
    const row = await companySettingsService.getCompanySettings(companyId);
    const adv = asRecord(row.advancedSettings);
    const prev = asRecord(adv[SCHOOL_ADVANCED_KEY]);
    const merged = { ...prev, ...payload };
    adv[SCHOOL_ADVANCED_KEY] = merged;

    await companySettingsService.updateCompanySettings(companyId, {
      advancedSettings: adv as Record<string, unknown>,
    });

    logger.info({ companyId }, 'School settings saved under advancedSettings.schoolSettings');
    return merged as SchoolSettingsInput;
  }
}

export const schoolSettingsService = new SchoolSettingsService();
