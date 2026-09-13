import prisma from '../../../shared/database/prisma';
import { Decimal } from '@prisma/client/runtime/library';
import { autoGlPostingService } from './auto-gl-posting.service';
import { treasuryPostingService } from '../../treasury/services/treasury-posting.service';
import { resolveDefaultTreasuryPostingContext } from '../../treasury/services/treasury-posting-context';
import { assertCashOverdraftAllowed } from '../../treasury/services/treasury-overdraft';

export interface CreateTreasuryPaymentData {
  branchId?: string;
  serial?: string;
  voucherNumber?: string;
  date: Date;
  hijriDate?: string;
  description?: string;
  paymentType: 'cash' | 'bank' | 'safe' | 'party';
  // Source (where money comes from)
  safeId?: string;
  bankAccountId?: string;
  accountId?: string;
  // Destination (where money goes)
  customerId?: string;
  supplierId?: string;
  // Amounts
  amount: number;
  currencyCode: string;
  exchangeRate?: number;
}

export interface UpdateTreasuryPaymentData {
  branchId?: string;
  serial?: string;
  voucherNumber?: string;
  date?: Date;
  hijriDate?: string;
  description?: string;
  paymentType?: 'cash' | 'bank' | 'safe' | 'party';
  safeId?: string;
  bankAccountId?: string;
  accountId?: string;
  customerId?: string;
  supplierId?: string;
  amount?: number;
  currencyCode?: string;
  exchangeRate?: number;
}

export class TreasuryPaymentService {
  /**
   * Get all treasury payments for a company
   */
  async getTreasuryPayments(
    companyId: string,
    options?: {
      startDate?: Date;
      endDate?: Date;
      paymentType?: string;
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

    if (options?.paymentType) {
      where.paymentType = options.paymentType;
    }

    if (options?.isPosted !== undefined) {
      where.isPosted = options.isPosted;
    }

    const [payments, total] = await Promise.all([
      prisma.treasuryPayment.findMany({
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
      prisma.treasuryPayment.count({ where }),
    ]);

    return {
      payments,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Get a single treasury payment by ID
   */
  async getTreasuryPaymentById(companyId: string, paymentId: string) {
    const payment = await prisma.treasuryPayment.findFirst({
      where: {
        id: paymentId,
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

    if (!payment) {
      throw new Error('Treasury payment not found');
    }

    return payment;
  }

  /**
   * Create a new treasury payment
   */
  async createTreasuryPayment(companyId: string, userId: string, data: CreateTreasuryPaymentData) {
    // Validate payment type and required fields
    this.validatePaymentData(data);
    await assertCashOverdraftAllowed({
      companyId,
      amount: Number(data.amount),
      safeId: data.safeId,
      bankAccountId: data.bankAccountId,
      accountId: data.accountId,
    });

    // Check voucher number uniqueness
    if (data.voucherNumber) {
      const existing = await prisma.treasuryPayment.findFirst({
        where: {
          companyId,
          voucherNumber: data.voucherNumber,
        },
      });

      if (existing) {
        throw new Error('Voucher number already exists');
      }
    }

    const payment = await prisma.treasuryPayment.create({
      data: {
        companyId,
        branchId: data.branchId,
        serial: data.serial,
        voucherNumber: data.voucherNumber,
        date: data.date,
        hijriDate: data.hijriDate,
        description: data.description,
        paymentType: data.paymentType,
        safeId: data.safeId,
        bankAccountId: data.bankAccountId,
        accountId: data.accountId,
        customerId: data.customerId,
        supplierId: data.supplierId,
        amount: new Decimal(data.amount),
        currencyCode: data.currencyCode,
        exchangeRate: data.exchangeRate ? new Decimal(data.exchangeRate) : null,
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

    if (await autoGlPostingService.isAutoPostEnabled(companyId)) {
      try {
        const ctx = await resolveDefaultTreasuryPostingContext(companyId, userId, data.date);
        await treasuryPostingService.postFromTreasuryPayment(ctx, payment.id);
        return this.getTreasuryPaymentById(companyId, payment.id);
      } catch (error) {
        await prisma.treasuryPayment.delete({ where: { id: payment.id } }).catch(() => undefined);
        throw error;
      }
    }

    return payment;
  }

  /**
   * Update a treasury payment
   */
  async updateTreasuryPayment(
    companyId: string,
    paymentId: string,
    data: UpdateTreasuryPaymentData
  ) {
    const payment = await this.getTreasuryPaymentById(companyId, paymentId);

    if (payment.isPosted) {
      throw new Error('Cannot update a posted treasury payment');
    }

    if (payment.isCancelled) {
      throw new Error('Cannot update a cancelled treasury payment');
    }

    // Validate if payment type is being changed
    if (data.paymentType) {
      const validationData = {
        paymentType: data.paymentType,
        customerId: data.customerId ?? payment.customerId,
        supplierId: data.supplierId ?? payment.supplierId,
        accountId: data.accountId ?? payment.accountId,
        safeId: data.safeId ?? payment.safeId,
        bankAccountId: data.bankAccountId ?? payment.bankAccountId,
      };
      this.validatePaymentType(validationData);
    }

    // Check voucher number uniqueness if changing
    if (data.voucherNumber && data.voucherNumber !== payment.voucherNumber) {
      const existing = await prisma.treasuryPayment.findFirst({
        where: {
          companyId,
          voucherNumber: data.voucherNumber,
          id: { not: paymentId },
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
    if (data.paymentType !== undefined) updateData.paymentType = data.paymentType;
    if (data.customerId !== undefined) updateData.customerId = data.customerId;
    if (data.supplierId !== undefined) updateData.supplierId = data.supplierId;
    if (data.accountId !== undefined) updateData.accountId = data.accountId;
    if (data.safeId !== undefined) updateData.safeId = data.safeId;
    if (data.bankAccountId !== undefined) updateData.bankAccountId = data.bankAccountId;
    if (data.amount !== undefined) updateData.amount = new Decimal(data.amount);
    if (data.currencyCode !== undefined) updateData.currencyCode = data.currencyCode;
    if (data.exchangeRate !== undefined)
      updateData.exchangeRate = data.exchangeRate ? new Decimal(data.exchangeRate) : null;

    return prisma.treasuryPayment.update({
      where: { id: paymentId },
      data: updateData,
      include: {
        customer: true,
        supplier: true,
        account: true,
        safe: true,
        bankAccount: { include: { bank: true } },
      },
    });
  }

  // Wave 2 fix: the legacy postTreasuryPayment/unpostTreasuryPayment methods
  // (and their createJournalEntryForPayment/updateBalancesForPayment/
  // reverseBalancesForPayment helpers) were removed here, mirroring the
  // treasury-receipt.service.ts fix — unpost hard-deleted the posted journal
  // entry instead of reversing it, and no route ever called these; posting
  // goes through `treasuryPostingService`.

  /**
   * Cancel a treasury payment
   */
  async cancelTreasuryPayment(companyId: string, paymentId: string) {
    const payment = await this.getTreasuryPaymentById(companyId, paymentId);

    if (payment.isPosted) {
      throw new Error('Cannot cancel a posted treasury payment. Unpost it first.');
    }

    if (payment.isCancelled) {
      throw new Error('Treasury payment is already cancelled');
    }

    return prisma.treasuryPayment.update({
      where: { id: paymentId },
      data: {
        isCancelled: true,
        cancelledAt: new Date(),
      },
    });
  }

  /**
   * Restore a cancelled treasury payment
   */
  async restoreTreasuryPayment(companyId: string, paymentId: string) {
    const payment = await this.getTreasuryPaymentById(companyId, paymentId);

    if (!payment.isCancelled) {
      throw new Error('Treasury payment is not cancelled');
    }

    return prisma.treasuryPayment.update({
      where: { id: paymentId },
      data: {
        isCancelled: false,
        cancelledAt: null,
      },
    });
  }

  /**
   * Validate payment data
   */
  private validatePaymentData(data: CreateTreasuryPaymentData | UpdateTreasuryPaymentData) {
    if ('paymentType' in data && data.paymentType) {
      this.validatePaymentType(data as any);
    }
  }

  /**
   * Validate payment type and required fields
   */
  private validatePaymentType(data: {
    paymentType: string;
    customerId?: string | null;
    supplierId?: string | null;
    accountId?: string | null;
    safeId?: string | null;
    bankAccountId?: string | null;
  }) {
    switch (data.paymentType) {
      case 'cash':
        if (!data.safeId) {
          throw new Error('Safe is required for cash payment');
        }
        break;
      case 'bank':
        if (!data.bankAccountId) {
          throw new Error('Bank account is required for bank payment');
        }
        break;
      case 'safe':
        if (!data.safeId) {
          throw new Error('Safe is required for safe payment');
        }
        break;
      case 'party':
        if (!data.customerId && !data.supplierId) {
          throw new Error('Customer or supplier is required for party payment');
        }
        if (!data.safeId && !data.bankAccountId) {
          throw new Error('Safe or bank account is required for party payment');
        }
        break;
      default:
        throw new Error(`Invalid payment type: ${data.paymentType}`);
    }
  }

}

export const treasuryPaymentService = new TreasuryPaymentService();

