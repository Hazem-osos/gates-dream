import prisma from '../../../shared/database/prisma';
import { logger } from '../../../shared/logger';

export interface CreateBankData {
  code?: string;
  arabicName: string;
  englishName?: string;
}

export interface UpdateBankData {
  code?: string;
  arabicName?: string;
  englishName?: string;
  isActive?: boolean;
}

export class BankService {
  /**
   * Get all banks for a company
   */
  async getBanks(companyId: string, options?: { isActive?: boolean }) {
    const where: any = { companyId };
    if (options?.isActive !== undefined) {
      where.isActive = options.isActive;
    }

    return prisma.bank.findMany({
      where,
      include: {
        bankAccounts: {
          where: { isActive: true },
        },
      },
      orderBy: { arabicName: 'asc' },
    });
  }

  /**
   * Get a single bank by ID
   */
  async getBankById(companyId: string, bankId: string) {
    const bank = await prisma.bank.findFirst({
      where: {
        id: bankId,
        companyId,
      },
      include: {
        bankAccounts: true,
      },
    });

    if (!bank) {
      throw new Error('Bank not found');
    }

    return bank;
  }

  /**
   * Create a new bank
   */
  async createBank(companyId: string, data: CreateBankData) {
    // Check if code already exists
    if (data.code) {
      const existing = await prisma.bank.findFirst({
        where: {
          companyId,
          code: data.code,
        },
      });

      if (existing) {
        throw new Error('Bank code already exists');
      }
    }

    return prisma.bank.create({
      data: {
        companyId,
        code: data.code,
        arabicName: data.arabicName,
        englishName: data.englishName,
        isActive: true,
      },
    });
  }

  /**
   * Update a bank
   */
  async updateBank(companyId: string, bankId: string, data: UpdateBankData) {
    const bank = await this.getBankById(companyId, bankId);

    // Check if code already exists (if changing)
    if (data.code && data.code !== bank.code) {
      const existing = await prisma.bank.findFirst({
        where: {
          companyId,
          code: data.code,
          id: { not: bankId },
        },
      });

      if (existing) {
        throw new Error('Bank code already exists');
      }
    }

    return prisma.bank.update({
      where: { id: bankId },
      data,
    });
  }

  /**
   * Delete a bank (soft delete by setting isActive to false)
   */
  async deleteBank(companyId: string, bankId: string) {
    const bank = await this.getBankById(companyId, bankId);

    // Check if bank has active accounts
    const activeAccounts = await prisma.bankAccount.count({
      where: {
        bankId,
        isActive: true,
      },
    });

    if (activeAccounts > 0) {
      throw new Error('Cannot delete bank with active accounts');
    }

    return prisma.bank.update({
      where: { id: bankId },
      data: { isActive: false },
    });
  }
}

export const bankService = new BankService();

