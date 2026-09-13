import prisma from '../../../shared/database/prisma';
import { invoiceAccountResolverService } from '../../invoices/services/invoice-account-resolver.service';

const DEFAULTS = {
  studentArAccountCode: '1220',
  unearnedTuitionRevenueAccountCode: '2480',
  earnedTuitionRevenueAccountCode: '4150',
  tuitionDiscountAccountCode: '5160',
  busRevenueAccountCode: '4160',
  booksRevenueAccountCode: '4170',
};

export class SchoolAccountResolverService {
  async getSettings(companyId: string) {
    return prisma.schoolSettings.upsert({
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
      studentArAccountId: await pick(
        settings.studentArAccountCode,
        DEFAULTS.studentArAccountCode
      ),
      unearnedTuitionRevenueAccountId: await pick(
        settings.unearnedTuitionRevenueAccountCode,
        DEFAULTS.unearnedTuitionRevenueAccountCode
      ),
      earnedTuitionRevenueAccountId: await pick(
        settings.earnedTuitionRevenueAccountCode,
        DEFAULTS.earnedTuitionRevenueAccountCode
      ),
      tuitionDiscountAccountId: await pick(
        settings.tuitionDiscountAccountCode,
        DEFAULTS.tuitionDiscountAccountCode
      ),
      busRevenueAccountId: await pick(
        settings.busRevenueAccountCode,
        DEFAULTS.busRevenueAccountCode
      ),
      booksRevenueAccountId: await pick(
        settings.booksRevenueAccountCode,
        DEFAULTS.booksRevenueAccountCode
      ),
    };
  }
}

export const schoolAccountResolverService = new SchoolAccountResolverService();
