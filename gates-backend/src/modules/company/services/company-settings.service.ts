import prisma from '../../../shared/database/prisma';
import { logger } from '../../../shared/logger';
import {
  getTenantCached,
  invalidateTenantCache,
  tenantCacheKeys,
} from '../../../shared/cache/tenant-metadata-cache';

export interface CompanySettingsData {
  // General settings
  fiscalYearStart?: string;
  fiscalYearEnd?: string;
  defaultCurrency?: string;
  journalEntryDigits?: number;
  allowNegativeBalance?: boolean;
  allowCostCenterWithoutAccount?: boolean;
  lockPostingBeforeDate?: string;
  enableApprovalsWorkflow?: boolean;
  autoNumbering?: boolean;
  decimalsInAmounts?: number;
  // Guide digits
  accountsGuideDigits?: number;
  costCentersGuideDigits?: number;
  storesGuideDigits?: number;
  itemsGuideDigits?: number;
  // Date settings
  dateUsage?: 'gregorian' | 'hijri' | 'both';
  operationsFromDate?: string;
  // Securities
  dueSecuritiesWarningDays?: number;
  // Budget settings
  budgetAllowExceed?: boolean;
  budgetWarnHalf?: boolean;
  budgetWarnSame?: boolean;
  budgetWarnExceed?: boolean;
  budgetStopMessageOnly?: boolean;
  budgetStopLedger?: boolean;
  budgetStopOrigin?: boolean;
  budgetStopBoth?: boolean;
  // System settings
  backupPath?: string;
  /** C8: only 'average' is implemented — see company-settings.schema.ts. */
  costMethod?: 'average';
  theme?: 'light' | 'dark';
  temporaryReceipts?: boolean;
  documentaryCredits?: boolean;
  pricingCalculationBasis?: 'SELECTED_UNIT_QTY' | 'BASE_UNIT_QTY';
  // Advanced settings
  advancedSettings?: Record<string, any>;
  executiveWhatsAppPhone?: string | null;
  // Account definitions
  accountDefinitions?: Record<string, any>;
  autoPostGl?: boolean;
  retainedEarningsAccountId?: string | null;
  preventNegativeStock?: boolean;
  preventCashOverdraft?: boolean;
  enforceCostCenterForPnl?: boolean;
  preventSellingBelowCost?: boolean;
  roundingAccountId?: string | null;
  exchangeGainLossAccountId?: string | null;
}

export class CompanySettingsService {
  /**
   * Get company settings by company ID
   */
  async getCompanySettings(companyId: string) {
    try {
      return await getTenantCached(tenantCacheKeys.companySettings(companyId), () =>
        this.loadCompanySettingsUncached(companyId)
      );
    } catch (error) {
      logger.error({ error, companyId }, 'Error getting company settings');
      throw error;
    }
  }

  private async loadCompanySettingsUncached(companyId: string) {
      // Verify company exists
      const company = await prisma.company.findUnique({
        where: { id: companyId },
      });

      if (!company) {
        throw new Error('Company not found');
      }

      // Get or create default settings
      let settings = await prisma.companySettings.findUnique({
        where: { companyId },
      });

      if (!settings) {
        // Create default settings
        settings = await prisma.companySettings.create({
          data: {
            companyId,
            journalEntryDigits: 6,
            allowNegativeBalance: false,
            allowCostCenterWithoutAccount: false,
            enableApprovalsWorkflow: true,
            autoNumbering: true,
            decimalsInAmounts: 2,
            budgetAllowExceed: false,
            budgetWarnHalf: false,
            budgetWarnSame: false,
            budgetWarnExceed: false,
            budgetStopMessageOnly: false,
            budgetStopLedger: false,
            budgetStopOrigin: false,
            budgetStopBoth: false,
            temporaryReceipts: false,
            documentaryCredits: false,
          },
        });
      }

      return settings;
  }

  /**
   * Update company settings
   */
  async updateCompanySettings(
    companyId: string,
    data: Partial<CompanySettingsData>
  ) {
    try {
      // Verify company exists
      const company = await prisma.company.findUnique({
        where: { id: companyId },
      });

      if (!company) {
        throw new Error('Company not found');
      }

      // Update or create settings
      const settings = await prisma.companySettings.upsert({
        where: { companyId },
        update: {
          fiscalYearStart: data.fiscalYearStart,
          fiscalYearEnd: data.fiscalYearEnd,
          defaultCurrency: data.defaultCurrency,
          journalEntryDigits: data.journalEntryDigits,
          allowNegativeBalance: data.allowNegativeBalance,
          allowCostCenterWithoutAccount: data.allowCostCenterWithoutAccount,
          lockPostingBeforeDate: data.lockPostingBeforeDate,
          enableApprovalsWorkflow: data.enableApprovalsWorkflow,
          autoNumbering: data.autoNumbering,
          decimalsInAmounts: data.decimalsInAmounts,
          accountsGuideDigits: data.accountsGuideDigits,
          costCentersGuideDigits: data.costCentersGuideDigits,
          storesGuideDigits: data.storesGuideDigits,
          itemsGuideDigits: data.itemsGuideDigits,
          dateUsage: data.dateUsage,
          operationsFromDate: data.operationsFromDate,
          dueSecuritiesWarningDays: data.dueSecuritiesWarningDays,
          budgetAllowExceed: data.budgetAllowExceed,
          budgetWarnHalf: data.budgetWarnHalf,
          budgetWarnSame: data.budgetWarnSame,
          budgetWarnExceed: data.budgetWarnExceed,
          budgetStopMessageOnly: data.budgetStopMessageOnly,
          budgetStopLedger: data.budgetStopLedger,
          budgetStopOrigin: data.budgetStopOrigin,
          budgetStopBoth: data.budgetStopBoth,
          backupPath: data.backupPath,
          costMethod: data.costMethod,
          theme: data.theme,
          temporaryReceipts: data.temporaryReceipts,
          documentaryCredits: data.documentaryCredits,
          pricingCalculationBasis: data.pricingCalculationBasis,
          advancedSettings: data.advancedSettings || undefined,
          accountDefinitions: data.accountDefinitions || undefined,
          executiveWhatsAppPhone: data.executiveWhatsAppPhone ?? undefined,
          autoPostGl: data.autoPostGl,
          retainedEarningsAccountId: data.retainedEarningsAccountId,
          preventNegativeStock: data.preventNegativeStock,
          preventCashOverdraft: data.preventCashOverdraft,
          enforceCostCenterForPnl: data.enforceCostCenterForPnl,
          preventSellingBelowCost: data.preventSellingBelowCost,
          roundingAccountId: data.roundingAccountId,
          exchangeGainLossAccountId: data.exchangeGainLossAccountId,
        },
        create: {
          companyId,
          fiscalYearStart: data.fiscalYearStart,
          fiscalYearEnd: data.fiscalYearEnd,
          defaultCurrency: data.defaultCurrency,
          journalEntryDigits: data.journalEntryDigits || 6,
          allowNegativeBalance: data.allowNegativeBalance ?? false,
          allowCostCenterWithoutAccount:
            data.allowCostCenterWithoutAccount ?? false,
          lockPostingBeforeDate: data.lockPostingBeforeDate,
          enableApprovalsWorkflow: data.enableApprovalsWorkflow ?? true,
          autoNumbering: data.autoNumbering ?? true,
          decimalsInAmounts: data.decimalsInAmounts || 2,
          accountsGuideDigits: data.accountsGuideDigits,
          costCentersGuideDigits: data.costCentersGuideDigits,
          storesGuideDigits: data.storesGuideDigits,
          itemsGuideDigits: data.itemsGuideDigits,
          dateUsage: data.dateUsage,
          operationsFromDate: data.operationsFromDate,
          dueSecuritiesWarningDays: data.dueSecuritiesWarningDays,
          budgetAllowExceed: data.budgetAllowExceed ?? false,
          budgetWarnHalf: data.budgetWarnHalf ?? false,
          budgetWarnSame: data.budgetWarnSame ?? false,
          budgetWarnExceed: data.budgetWarnExceed ?? false,
          budgetStopMessageOnly: data.budgetStopMessageOnly ?? false,
          budgetStopLedger: data.budgetStopLedger ?? false,
          budgetStopOrigin: data.budgetStopOrigin ?? false,
          budgetStopBoth: data.budgetStopBoth ?? false,
          backupPath: data.backupPath,
          costMethod: data.costMethod,
          theme: data.theme,
          temporaryReceipts: data.temporaryReceipts ?? false,
          documentaryCredits: data.documentaryCredits ?? false,
          pricingCalculationBasis: data.pricingCalculationBasis ?? 'SELECTED_UNIT_QTY',
          advancedSettings: data.advancedSettings || undefined,
          accountDefinitions: data.accountDefinitions || undefined,
          executiveWhatsAppPhone: data.executiveWhatsAppPhone ?? undefined,
          autoPostGl: data.autoPostGl ?? true,
          retainedEarningsAccountId: data.retainedEarningsAccountId,
          preventNegativeStock: data.preventNegativeStock ?? true,
          preventCashOverdraft: data.preventCashOverdraft ?? true,
          enforceCostCenterForPnl: data.enforceCostCenterForPnl ?? false,
          preventSellingBelowCost: data.preventSellingBelowCost ?? false,
          roundingAccountId: data.roundingAccountId,
          exchangeGainLossAccountId: data.exchangeGainLossAccountId,
        },
      });

      logger.info({ companyId }, 'Company settings updated');
      await invalidateTenantCache(tenantCacheKeys.companySettings(companyId));
      await invalidateTenantCache(tenantCacheKeys.settings(companyId));
      await invalidateTenantCache(tenantCacheKeys.taxRates(companyId));
      return settings;
    } catch (error) {
      logger.error({ error, companyId, data }, 'Error updating company settings');
      throw error;
    }
  }

  /**
   * Reset company settings to defaults
   */
  async resetCompanySettings(companyId: string) {
    try {
      // Verify company exists
      const company = await prisma.company.findUnique({
        where: { id: companyId },
      });

      if (!company) {
        throw new Error('Company not found');
      }

      // Delete existing settings and create defaults
      await prisma.companySettings.deleteMany({
        where: { companyId },
      });

      const defaultSettings = await prisma.companySettings.create({
        data: {
          companyId,
          journalEntryDigits: 6,
          allowNegativeBalance: false,
          allowCostCenterWithoutAccount: false,
          enableApprovalsWorkflow: true,
          autoNumbering: true,
          decimalsInAmounts: 2,
          budgetAllowExceed: false,
          budgetWarnHalf: false,
          budgetWarnSame: false,
          budgetWarnExceed: false,
          budgetStopMessageOnly: false,
          budgetStopLedger: false,
          budgetStopOrigin: false,
          budgetStopBoth: false,
          temporaryReceipts: false,
          documentaryCredits: false,
        },
      });

      logger.info({ companyId }, 'Company settings reset to defaults');
      await invalidateTenantCache(tenantCacheKeys.companySettings(companyId));
      await invalidateTenantCache(tenantCacheKeys.settings(companyId));
      await invalidateTenantCache(tenantCacheKeys.taxRates(companyId));
      return defaultSettings;
    } catch (error) {
      logger.error({ error, companyId }, 'Error resetting company settings');
      throw error;
    }
  }
}

export const companySettingsService = new CompanySettingsService();

