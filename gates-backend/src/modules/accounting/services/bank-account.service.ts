import prisma from '../../../shared/database/prisma';
import { logger } from '../../../shared/logger';

export interface CreateBankAccountData {
  bankId: string;
  code?: string;
  arabicName: string;
  englishName?: string;
  accountNumber?: string;
  iban?: string;
  currencyCode: string;
}

export interface UpdateBankAccountData {
  code?: string;
  arabicName?: string;
  englishName?: string;
  accountNumber?: string;
  iban?: string;
  currencyCode?: string;
  isActive?: boolean;
}

export class BankAccountService {
  /**
   * Get all bank accounts for a company
   */
  async getBankAccounts(
    companyId: string,
    options?: { bankId?: string; isActive?: boolean; allowedBankAccountIds?: string[] | null }
  ) {
    const where: any = { companyId };
    if (options?.bankId) {
      where.bankId = options.bankId;
    }
    if (options?.isActive !== undefined) {
      where.isActive = options.isActive;
    }
    if (options?.allowedBankAccountIds) {
      where.id = { in: options.allowedBankAccountIds };
    }

    return prisma.bankAccount.findMany({
      where,
      include: {
        bank: true,
        glAccount: { select: { id: true, code: true, arabicName: true } },
      },
      orderBy: { arabicName: 'asc' },
    });
  }

  /**
   * Get a single bank account by ID
   */
  async getBankAccountById(companyId: string, bankAccountId: string) {
    const bankAccount = await prisma.bankAccount.findFirst({
      where: {
        id: bankAccountId,
        companyId,
      },
      include: {
        bank: true,
      },
    });

    if (!bankAccount) {
      throw new Error('Bank account not found');
    }

    return bankAccount;
  }

  /**
   * Create a new bank account
   */
  async createBankAccount(companyId: string, data: CreateBankAccountData) {
    // Verify bank exists
    const bank = await prisma.bank.findFirst({
      where: {
        id: data.bankId,
        companyId,
      },
    });

    if (!bank) {
      throw new Error('Bank not found');
    }

    // Check if code already exists
    if (data.code) {
      const existing = await prisma.bankAccount.findFirst({
        where: {
          companyId,
          code: data.code,
        },
      });

      if (existing) {
        throw new Error('Bank account code already exists');
      }
    }

    return prisma.bankAccount.create({
      data: {
        companyId,
        bankId: data.bankId,
        code: data.code,
        arabicName: data.arabicName,
        englishName: data.englishName,
        accountNumber: data.accountNumber,
        iban: data.iban,
        currencyCode: data.currencyCode,
        balance: 0,
        isActive: true,
      },
      include: {
        bank: true,
      },
    });
  }

  /**
   * Update a bank account
   */
  async updateBankAccount(companyId: string, bankAccountId: string, data: UpdateBankAccountData) {
    const bankAccount = await this.getBankAccountById(companyId, bankAccountId);

    // Check if code already exists (if changing)
    if (data.code && data.code !== bankAccount.code) {
      const existing = await prisma.bankAccount.findFirst({
        where: {
          companyId,
          code: data.code,
          id: { not: bankAccountId },
        },
      });

      if (existing) {
        throw new Error('Bank account code already exists');
      }
    }

    return prisma.bankAccount.update({
      where: { id: bankAccountId },
      data,
      include: {
        bank: true,
      },
    });
  }

  /**
   * Delete a bank account (soft delete by setting isActive to false)
   */
  async deleteBankAccount(companyId: string, bankAccountId: string) {
    await this.getBankAccountById(companyId, bankAccountId);

    return prisma.bankAccount.update({
      where: { id: bankAccountId },
      data: { isActive: false },
    });
  }
}

export const bankAccountService = new BankAccountService();

