import prisma from '../../../shared/database/prisma';
import { invoiceAccountResolverService } from '../../invoices/services/invoice-account-resolver.service';

const DEFAULTS = {
  realEstateArAccountCode: '1210',
  unearnedRealEstateRevenueAccountCode: '2460',
  realEstateRevenueAccountCode: '4100',
  maintenanceDepositsAccountCode: '2470',
  penaltyRevenueAccountCode: '4110',
  bankAccountCode: '1110',
  pdcUnderCollectionAccountCode: '1220',
  assignmentFeeRevenueAccountCode: '4120',
  cashAccountCode: '1100',
  forfeitureRevenueAccountCode: '4130',
  customerRefundPayableAccountCode: '2130',
  rentalManagementFeeAccountCode: '4140',
  ownerPayableAccountCode: '2140',
  rentalOpexAccountCode: '5100',
};

export class RealEstateAccountResolverService {
  async getSettings(companyId: string) {
    return prisma.realEstateSettings.upsert({
      where: { companyId },
      update: {},
      create: { companyId },
    });
  }

  async resolveAccounts(companyId: string) {
    const settings = await this.getSettings(companyId);
    const pick = (code: string | null | undefined, fallback: string) =>
      invoiceAccountResolverService.resolveAccountId(
        companyId,
        (code && code.trim()) || fallback
      );

    return {
      settings,
      realEstateArAccountId: await pick(
        settings.realEstateArAccountCode,
        DEFAULTS.realEstateArAccountCode
      ),
      unearnedRealEstateRevenueAccountId: await pick(
        settings.unearnedRealEstateRevenueAccountCode,
        DEFAULTS.unearnedRealEstateRevenueAccountCode
      ),
      realEstateRevenueAccountId: await pick(
        settings.realEstateRevenueAccountCode,
        DEFAULTS.realEstateRevenueAccountCode
      ),
      maintenanceDepositsAccountId: await pick(
        settings.maintenanceDepositsAccountCode,
        DEFAULTS.maintenanceDepositsAccountCode
      ),
      penaltyRevenueAccountId: await pick(
        settings.penaltyRevenueAccountCode,
        DEFAULTS.penaltyRevenueAccountCode
      ),
      bankAccountId: await pick(null, DEFAULTS.bankAccountCode),
      pdcUnderCollectionAccountId: await pick(null, DEFAULTS.pdcUnderCollectionAccountCode),
      assignmentFeeRevenueAccountId: await pick(null, DEFAULTS.assignmentFeeRevenueAccountCode),
      cashAccountId: await pick(null, DEFAULTS.cashAccountCode),
      forfeitureRevenueAccountId: await pick(null, DEFAULTS.forfeitureRevenueAccountCode),
      customerRefundPayableAccountId: await pick(null, DEFAULTS.customerRefundPayableAccountCode),
      rentalManagementFeeAccountId: await pick(null, DEFAULTS.rentalManagementFeeAccountCode),
      ownerPayableAccountId: await pick(null, DEFAULTS.ownerPayableAccountCode),
      rentalOpexAccountId: await pick(null, DEFAULTS.rentalOpexAccountCode),
    };
  }
}

export const realEstateAccountResolverService = new RealEstateAccountResolverService();
