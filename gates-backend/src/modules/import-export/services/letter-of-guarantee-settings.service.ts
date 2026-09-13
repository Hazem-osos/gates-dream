import prisma from '../../../shared/database/prisma';
import { logger } from '../../../shared/logger';
import { Decimal } from '@prisma/client/runtime/library';

export interface CreateLetterOfGuaranteeSettingsData {
  guaranteeAccountId?: string | null;
  expenseAccountId?: string | null;
  defaultCurrencyId?: string | null;
  defaultBidPercentage?: number | null;
  autoRenewalEnabled?: boolean;
  renewalWarningDays?: number | null;
  includeBankExpenses?: boolean;
}

export class LetterOfGuaranteeSettingsService {
  async get(companyId: string) {
    try {
      let settings = await prisma.letterOfGuaranteeSettings.findUnique({
        where: { companyId },
      });

      if (!settings) {
        // Create default settings if they don't exist
        settings = await prisma.letterOfGuaranteeSettings.create({
          data: {
            companyId,
            autoRenewalEnabled: false,
            includeBankExpenses: false,
          },
        });
      }

      return settings;
    } catch (error) {
      logger.error({ error, companyId }, 'Error getting letter of guarantee settings');
      throw error;
    }
  }

  async createOrUpdate(companyId: string, data: CreateLetterOfGuaranteeSettingsData) {
    try {
      const existing = await prisma.letterOfGuaranteeSettings.findUnique({
        where: { companyId },
      });

      const settingsData: any = {
        guaranteeAccountId: data.guaranteeAccountId,
        expenseAccountId: data.expenseAccountId,
        defaultCurrencyId: data.defaultCurrencyId,
        defaultBidPercentage: data.defaultBidPercentage ? new Decimal(data.defaultBidPercentage) : null,
        autoRenewalEnabled: data.autoRenewalEnabled ?? false,
        renewalWarningDays: data.renewalWarningDays,
        includeBankExpenses: data.includeBankExpenses ?? false,
      };

      const settings = existing
        ? await prisma.letterOfGuaranteeSettings.update({
            where: { companyId },
            data: settingsData,
          })
        : await prisma.letterOfGuaranteeSettings.create({
            data: {
              companyId,
              ...settingsData,
            },
          });

      logger.info({ companyId }, 'Letter of guarantee settings updated');
      return settings;
    } catch (error) {
      logger.error({ error, companyId, data }, 'Error updating letter of guarantee settings');
      throw error;
    }
  }
}

export const letterOfGuaranteeSettingsService = new LetterOfGuaranteeSettingsService();

