import prisma from '../../../shared/database/prisma';
import { Decimal } from '@prisma/client/runtime/library';
import { documentSequenceService } from '../../platform/services/document-sequence.service';
import { persistFxDecimal } from '../utils/company-fx-rate';

export interface CreateTreasuryReceiptData {
  branchId?: string;
  serial?: string;
  voucherNumber?: string;
  date: Date;
  hijriDate?: string;
  description?: string;
  receiptType: 'cash' | 'bank' | 'safe' | 'party';
  // Source (where money comes from)
  customerId?: string;
  supplierId?: string;
  accountId?: string;
  // Destination (where money goes)
  safeId?: string;
  bankAccountId?: string;
  // Amounts
  amount: number;
  currencyCode: string;
  exchangeRate?: number;
}

export interface UpdateTreasuryReceiptData {
  branchId?: string;
  serial?: string;
  voucherNumber?: string;
  date?: Date;
  hijriDate?: string;
  description?: string;
  receiptType?: 'cash' | 'bank' | 'safe' | 'party';
  customerId?: string;
  supplierId?: string;
  accountId?: string;
  safeId?: string;
  bankAccountId?: string;
  amount?: number;
  currencyCode?: string;
  exchangeRate?: number;
}

export class TreasuryReceiptService {
  /**
   * Get all treasury receipts for a company
   */
  async getTreasuryReceipts(
    companyId: string,
    options?: {
      startDate?: Date;
      endDate?: Date;
      receiptType?: string;
      isPosted?: boolean;
      page?: number;
      limit?: number;
    }
  ) {
    const page = options?.page || 1;
    const limit = options?.limit || 50;
    const skip = (page - 1) * limit;

    const where: any = { companyId };

    if (options?.startDate || options?.endDate) {
      where.date = {};
      if (options.startDate) where.date.gte = options.startDate;
      if (options.endDate) where.date.lte = options.endDate;
    }

    if (options?.receiptType) {
      where.receiptType = options.receiptType;
    }

    if (options?.isPosted !== undefined) {
      where.isPosted = options.isPosted;
    }

    const [receipts, total] = await Promise.all([
      prisma.treasuryReceipt.findMany({
        where,
        skip,
        take: limit,
        orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
        include: {
          customer: { select: { id: true, arabicName: true, code: true } },
          supplier: { select: { id: true, arabicName: true, code: true } },
          account: { select: { id: true, code: true, arabicName: true } },
          safe: { select: { id: true, arabicName: true, code: true } },
          bankAccount: {
            select: {
              id: true,
              arabicName: true,
              code: true,
              bank: { select: { arabicName: true } },
            },
          },
        },
      }),
      prisma.treasuryReceipt.count({ where }),
    ]);

    return {
      receipts,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Get a single treasury receipt by ID
   */
  async getTreasuryReceiptById(companyId: string, receiptId: string) {
    const receipt = await prisma.treasuryReceipt.findFirst({
      where: {
        id: receiptId,
        companyId,
      },
      include: {
        customer: true,
        supplier: true,
        account: true,
        safe: true,
        bankAccount: {
          include: {
            bank: true,
          },
        },
        journalEntry: {
          include: {
            lines: true,
          },
        },
      },
    });

    if (!receipt) {
      throw new Error('Treasury receipt not found');
    }

    return receipt;
  }

  /**
   * Create a new treasury receipt
   */
  async createTreasuryReceipt(companyId: string, _userId: string, data: CreateTreasuryReceiptData) {
    // Validate receipt type and required fields
    this.validateReceiptData(data);

    const voucherFamily = 'TEMP';
    let voucherNumber = data.voucherNumber?.trim() || data.serial?.trim() || undefined;
    if (!voucherNumber) {
      voucherNumber = await documentSequenceService.nextNumberForFamily({
        companyId,
        branchId: data.branchId ?? null,
        fiscalYearId: null,
        docType: 'TEMP-RECEIPT',
        legacySuffix: 'TEMP',
        seedFromExisting: documentSequenceService.maxExistingNumber(async () => {
          const rows = await prisma.treasuryReceipt.findMany({
            where: { companyId, voucherFamily },
            select: { voucherNumber: true },
          });
          return rows.map((row) => row.voucherNumber);
        }),
        isAvailable: async (candidate) => {
          const taken = await prisma.treasuryReceipt.findFirst({
            where: { companyId, voucherFamily, voucherNumber: candidate },
            select: { id: true },
          });
          return !taken;
        },
      });
    }
    if (!voucherNumber) {
      throw new Error('رقم الإيصال مطلوب — الترقيم يدوي لهذا النوع');
    }
    const existing = await prisma.treasuryReceipt.findFirst({
      where: { companyId, voucherFamily, voucherNumber },
      select: { id: true },
    });
    if (existing) {
      throw new Error('Voucher number already exists');
    }

    const receipt = await prisma.treasuryReceipt.create({
      data: {
        companyId,
        branchId: data.branchId,
        serial: data.serial || voucherNumber,
        voucherNumber,
        date: data.date,
        hijriDate: data.hijriDate,
        description: data.description,
        receiptType: data.receiptType,
        customerId: data.customerId,
        supplierId: data.supplierId,
        accountId: data.accountId,
        safeId: data.safeId,
        bankAccountId: data.bankAccountId,
        voucherFamily,
        amount: new Decimal(data.amount),
        currencyCode: data.currencyCode,
        exchangeRate: persistFxDecimal(data.currencyCode, data.exchangeRate),
        isPosted: false,
        isApproved: false,
        isCancelled: false,
      },
      include: {
        customer: true,
        supplier: true,
        account: true,
        safe: true,
        bankAccount: { include: { bank: true } },
      },
    });

    // Temporary receipts stay drafts. Auto-post has no offset account, fails,
    // and deletes the row, so the screen looked like the save never happened.
    return receipt;
  }

  /**
   * Update a treasury receipt
   */
  async updateTreasuryReceipt(
    companyId: string,
    receiptId: string,
    data: UpdateTreasuryReceiptData
  ) {
    const receipt = await this.getTreasuryReceiptById(companyId, receiptId);

    if (receipt.isPosted) {
      throw new Error('Cannot update a posted treasury receipt');
    }

    if (receipt.isCancelled) {
      throw new Error('Cannot update a cancelled treasury receipt');
    }

    // Validate if receipt type is being changed
    if (data.receiptType) {
      const validationData = {
        receiptType: data.receiptType,
        customerId: data.customerId ?? receipt.customerId,
        supplierId: data.supplierId ?? receipt.supplierId,
        accountId: data.accountId ?? receipt.accountId,
        safeId: data.safeId ?? receipt.safeId,
        bankAccountId: data.bankAccountId ?? receipt.bankAccountId,
      };
      this.validateReceiptType(validationData);
    }

    const voucherFamily = 'TEMP';
    if (data.voucherNumber && data.voucherNumber !== receipt.voucherNumber) {
      const existing = await prisma.treasuryReceipt.findFirst({
        where: {
          companyId,
          voucherFamily,
          voucherNumber: data.voucherNumber,
          id: { not: receiptId },
        },
      });

      if (existing) {
        throw new Error('Voucher number already exists');
      }
    }

    const updateData: any = {};
    if (data.branchId !== undefined) updateData.branchId = data.branchId;
    if (data.serial !== undefined) updateData.serial = data.serial;
    if (data.voucherNumber !== undefined) updateData.voucherNumber = data.voucherNumber;
    if (data.date !== undefined) updateData.date = data.date;
    if (data.hijriDate !== undefined) updateData.hijriDate = data.hijriDate;
    if (data.description !== undefined) updateData.description = data.description;
    if (data.receiptType !== undefined) updateData.receiptType = data.receiptType;
    if (data.customerId !== undefined) updateData.customerId = data.customerId;
    if (data.supplierId !== undefined) updateData.supplierId = data.supplierId;
    if (data.accountId !== undefined) updateData.accountId = data.accountId;
    if (data.safeId !== undefined) updateData.safeId = data.safeId;
    if (data.bankAccountId !== undefined) {
      updateData.bankAccountId = data.bankAccountId;
      updateData.voucherFamily = 'TEMP';
    }
    if (data.amount !== undefined) updateData.amount = new Decimal(data.amount);
    if (data.currencyCode !== undefined) updateData.currencyCode = data.currencyCode;
    if (data.exchangeRate !== undefined)
      updateData.exchangeRate = data.exchangeRate ? new Decimal(data.exchangeRate) : null;

    const updated = await prisma.treasuryReceipt.updateMany({
      where: { id: receiptId, companyId },
      data: updateData,
    });
    if (updated.count !== 1) throw new Error('Treasury receipt not found');
    return this.getTreasuryReceiptById(companyId, receiptId);
  }

  // Wave 2 fix: the legacy postTreasuryReceipt/unpostTreasuryReceipt methods
  // (and their createJournalEntryForReceipt/updateBalancesForReceipt/
  // reverseBalancesForReceipt helpers) were removed here. They posted in
  // place with a hand-rolled journal entry (no fiscal-year check, no
  // activeSourceKey de-dup) and unpost hard-deleted the posted journal entry
  // — destroying the audit trail instead of reversing it. No route ever
  // called them; `treasuryPostingService` is the real posting path used by
  // `treasury-receipt.routes.ts`.

  /**
   * Cancel a treasury receipt
   */
  async cancelTreasuryReceipt(companyId: string, receiptId: string) {
    const receipt = await this.getTreasuryReceiptById(companyId, receiptId);

    if (receipt.isPosted) {
      throw new Error('Cannot cancel a posted treasury receipt. Unpost it first.');
    }

    if (receipt.isCancelled) {
      throw new Error('Treasury receipt is already cancelled');
    }

    const updated = await prisma.treasuryReceipt.updateMany({
      where: { id: receiptId, companyId },
      data: {
        isCancelled: true,
        cancelledAt: new Date(),
      },
    });
    if (updated.count !== 1) throw new Error('Treasury receipt not found');
    return this.getTreasuryReceiptById(companyId, receiptId);
  }

  /**
   * Restore a cancelled treasury receipt
   */
  async restoreTreasuryReceipt(companyId: string, receiptId: string) {
    const receipt = await this.getTreasuryReceiptById(companyId, receiptId);

    if (!receipt.isCancelled) {
      throw new Error('Treasury receipt is not cancelled');
    }

    return prisma.treasuryReceipt.update({
      where: { id: receiptId },
      data: {
        isCancelled: false,
        cancelledAt: null,
      },
    });
  }

  /**
   * Validate receipt data
   */
  private validateReceiptData(data: CreateTreasuryReceiptData | UpdateTreasuryReceiptData) {
    if ('receiptType' in data && data.receiptType) {
      this.validateReceiptType(data as any);
    }
  }

  /**
   * Validate receipt type and required fields
   */
  private validateReceiptType(data: {
    receiptType: string;
    customerId?: string | null;
    supplierId?: string | null;
    accountId?: string | null;
    safeId?: string | null;
    bankAccountId?: string | null;
  }) {
    switch (data.receiptType) {
      case 'cash':
        // Cash receipt: must have safeId
        if (!data.safeId) {
          throw new Error('Safe is required for cash receipt');
        }
        break;
      case 'bank':
        // Bank receipt: must have bankAccountId
        if (!data.bankAccountId) {
          throw new Error('Bank account is required for bank receipt');
        }
        break;
      case 'safe':
        // Safe receipt: must have safeId
        if (!data.safeId) {
          throw new Error('Safe is required for safe receipt');
        }
        break;
      case 'party':
        // Party receipt: must have customerId or supplierId, and safeId or bankAccountId
        if (!data.customerId && !data.supplierId) {
          throw new Error('Customer or supplier is required for party receipt');
        }
        if (!data.safeId && !data.bankAccountId) {
          throw new Error('Safe or bank account is required for party receipt');
        }
        break;
      default:
        throw new Error(`Invalid receipt type: ${data.receiptType}`);
    }
  }

}

export const treasuryReceiptService = new TreasuryReceiptService();

