import prisma from '../../../shared/database/prisma';
import { logger } from '../../../shared/logger';
import { eInvoiceSubmissionService } from './e-invoice-submission.service';

export interface ElectronicInvoiceSettings {
  companyId: string;
  taxAuthority?: 'ETA' | 'ZATCA' | 'FTA';
  clientId?: string;
  clientSecret?: string;
  tokenPin?: string;
  environment?: 'PRE_PRODUCTION' | 'PRODUCTION';
  issuerTaxId?: string;
  issuerName?: string;
  activityCode?: string;
  apiBaseUrl?: string;
  autoSubmit?: boolean;
  defaultTaxRate?: number;
  invoicePrefix?: string;
  returnPrefix?: string;
  amendmentPrefix?: string;
}

export class ElectronicInvoiceSettingsService {
  async getSettings(companyId: string): Promise<ElectronicInvoiceSettings> {
    try {
      const row = await eInvoiceSubmissionService.getSettings(companyId);
      return {
        companyId,
        taxAuthority: 'ETA',
        clientId: row?.clientId ?? undefined,
        clientSecret: row?.clientSecret ? '***' : undefined,
        tokenPin: row?.tokenPin ? '***' : undefined,
        environment: (row?.environment as 'PRE_PRODUCTION' | 'PRODUCTION') ?? 'PRE_PRODUCTION',
        issuerTaxId: row?.issuerTaxId ?? undefined,
        issuerName: row?.issuerName ?? undefined,
        activityCode: row?.activityCode ?? undefined,
        apiBaseUrl: row?.apiBaseUrl ?? undefined,
        autoSubmit: false,
        defaultTaxRate: 14,
        invoicePrefix: 'INV',
        returnPrefix: 'RET',
        amendmentPrefix: 'AMEND',
      };
    } catch (error) {
      logger.error({ error, companyId }, 'Error getting electronic invoice settings');
      throw error;
    }
  }

  async updateSettings(companyId: string, settings: Partial<ElectronicInvoiceSettings>) {
    try {
      const updated = await eInvoiceSubmissionService.upsertSettings(companyId, {
        clientId: settings.clientId,
        clientSecret: settings.clientSecret,
        tokenPin: settings.tokenPin,
        environment: settings.environment,
        issuerTaxId: settings.issuerTaxId,
        issuerName: settings.issuerName,
        activityCode: settings.activityCode,
        apiBaseUrl: settings.apiBaseUrl,
      });
      logger.info({ companyId }, 'Electronic invoice settings updated');
      return {
        companyId,
        ...settings,
        clientSecret: updated.clientSecret ? '***' : undefined,
      };
    } catch (error) {
      logger.error({ error, companyId }, 'Error updating electronic invoice settings');
      throw error;
    }
  }
}

export const electronicInvoiceSettingsService = new ElectronicInvoiceSettingsService();
