import { logger } from '../../../shared/logger';
import { eInvoiceSubmissionService } from './e-invoice-submission.service';
import {
  buildEinvoiceSettingsPatch,
  toPublicEinvoiceSettings,
  type EinvoiceSettingsInput,
} from '../utils/einvoice-settings-map';

export class ElectronicInvoiceSettingsService {
  async getSettings(companyId: string) {
    try {
      const row = await eInvoiceSubmissionService.getSettings(companyId);
      return toPublicEinvoiceSettings(companyId, row);
    } catch (error) {
      logger.error({ error, companyId }, 'Error getting electronic invoice settings');
      throw error;
    }
  }

  async updateSettings(companyId: string, settings: EinvoiceSettingsInput) {
    try {
      const existing = await eInvoiceSubmissionService.getSettings(companyId);
      const patch = buildEinvoiceSettingsPatch(settings, existing);
      const updated = await eInvoiceSubmissionService.upsertSettings(companyId, patch);
      logger.info({ companyId }, 'Electronic invoice settings updated');
      return toPublicEinvoiceSettings(companyId, updated);
    } catch (error) {
      logger.error({ error, companyId }, 'Error updating electronic invoice settings');
      throw error;
    }
  }
}

export const electronicInvoiceSettingsService = new ElectronicInvoiceSettingsService();
