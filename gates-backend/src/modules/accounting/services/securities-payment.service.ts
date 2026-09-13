import prisma from '../../../shared/database/prisma';
import { logger } from '../../../shared/logger';
import { Decimal } from '@prisma/client/runtime/library';
import { AppError } from '../../../shared/middleware/error-handler';
import { documentSequenceService } from '../../platform/services/document-sequence.service';
import { journalPostingService } from './journal-posting.service';
import { fiscalYearService } from '../../platform/services/fiscal-year.service';
import { treasuryAccountResolverService } from '../../treasury/services/treasury-account-resolver.service';
import { commercialPaperPostingService } from './commercial-paper-posting.service';

/** Minimal context needed to post a real GL entry for a securities payment (H11). */
export interface SecuritiesPostingCtx {
  branchId?: string | null;
  userId: string;
}

export interface CreateSecuritiesPaymentData {
  branchId?: string;
  serial?: string;
  paymentNumber?: string;
  date: Date;
  hijriDate?: string;
  description?: string;
  securityType: 'check' | 'promissory-note' | 'bond' | 'other';
  customerId?: string;
  supplierId?: string;
  destinationAccountId?: string | null;
  payeeName?: string;
  payeeBank?: string;
  securityNumber?: string;
  dueDate?: Date;
  amount: number;
  currencyCode: string;
  entityName?: string | null;
}

export interface UpdateSecuritiesPaymentData {
  branchId?: string;
  serial?: string;
  paymentNumber?: string;
  date?: Date;
  hijriDate?: string;
  description?: string;
  securityType?: 'check' | 'promissory-note' | 'bond' | 'other';
  customerId?: string;
  supplierId?: string;
  destinationAccountId?: string | null;
  payeeName?: string;
  payeeBank?: string;
  securityNumber?: string;
  dueDate?: Date;
  amount?: number;
  currencyCode?: string;
  entityName?: string | null;
}

export class SecuritiesPaymentService {
  /**
   * Get all securities payments for a company
   */
  async getSecuritiesPayments(
    companyId: string,
    options?: {
      startDate?: Date;
      endDate?: Date;
      securityType?: string;
      customerId?: string;
      supplierId?: string;
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

    if (options?.securityType) {
      where.securityType = options.securityType;
    }

    if (options?.customerId) {
      where.customerId = options.customerId;
    }

    if (options?.supplierId) {
      where.supplierId = options.supplierId;
    }

    if (options?.isPosted !== undefined) {
      where.isPosted = options.isPosted;
    }

    const [payments, total] = await Promise.all([
      prisma.securitiesPayment.findMany({
        where,
        skip,
        take: limit,
        orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
        include: {
          customer: { select: { id: true, arabicName: true, code: true } },
          supplier: { select: { id: true, arabicName: true, code: true } },
        },
      }),
      prisma.securitiesPayment.count({ where }),
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
   * Get a single securities payment by ID
   */
  async getSecuritiesPaymentById(companyId: string, paymentId: string) {
    const payment = await prisma.securitiesPayment.findFirst({
      where: {
        id: paymentId,
        companyId,
      },
      include: {
        customer: true,
        supplier: true,
      },
    });

    if (!payment) {
      throw new Error('Securities payment not found');
    }

    const multiCollectionLines = await commercialPaperPostingService.listLines(
      companyId,
      'PAYMENT',
      paymentId
    );
    return { ...payment, multiCollectionLines };
  }

  /**
   * Create a new securities payment
   */
  async createSecuritiesPayment(companyId: string, data: CreateSecuritiesPaymentData) {
    if (!data.customerId && !data.supplierId && !data.destinationAccountId) {
      throw new Error('اختر العميل أو حساباً آخر');
    }
    if (data.destinationAccountId) {
      const account = await prisma.account.findFirst({
        where: { id: data.destinationAccountId, companyId },
        select: { id: true },
      });
      if (!account) throw new AppError(400, 'الحساب المختار غير موجود');
    }

    // Check payment number uniqueness
    if (data.paymentNumber) {
      const existing = await prisma.securitiesPayment.findFirst({
        where: {
          companyId,
          paymentNumber: data.paymentNumber,
        },
      });

      if (existing) {
        throw new Error('Payment number already exists');
      }
    }

    // Legacy `CreatePKNum` numbers the issued-securities voucher.
    const paymentNumber =
      data.paymentNumber?.trim() ||
      (await documentSequenceService.nextNumberForFamily({
        companyId,
        branchId: data.branchId ?? null,
        fiscalYearId: null,
        docType: 'PK-SECURITIES',
        legacySuffix: 'PK01',
        seedFromExisting: documentSequenceService.maxExistingNumber(async () => {
          const rows = await prisma.securitiesPayment.findMany({
            where: { companyId },
            select: { paymentNumber: true },
          });
          return rows.map((r) => r.paymentNumber);
        }),
        isAvailable: async (candidate) => {
          const taken = await prisma.securitiesPayment.findFirst({
            where: { companyId, paymentNumber: candidate },
            select: { id: true },
          });
          return !taken;
        },
      })) ||
      null;

    return prisma.securitiesPayment.create({
      data: {
        companyId,
        branchId: data.branchId,
        serial: data.serial,
        paymentNumber,
        date: data.date,
        hijriDate: data.hijriDate,
        description: data.description,
        securityType: data.securityType,
        customerId: data.customerId,
        supplierId: data.supplierId,
        destinationAccountId: data.destinationAccountId,
        payeeName: data.payeeName,
        payeeBank: data.payeeBank,
        securityNumber: data.securityNumber,
        dueDate: data.dueDate,
        amount: new Decimal(data.amount),
        currencyCode: data.currencyCode,
        entityName: data.entityName,
        isPaid: true,
        isPosted: false,
        isApproved: false,
        isCancelled: false,
      },
      include: {
        customer: true,
        supplier: true,
      },
    });
  }

  /**
   * Update a securities payment
   */
  async updateSecuritiesPayment(
    companyId: string,
    paymentId: string,
    data: UpdateSecuritiesPaymentData
  ) {
    const payment = await this.getSecuritiesPaymentById(companyId, paymentId);

    if (payment.isPosted) {
      throw new Error('Cannot update a posted securities payment');
    }

    if (payment.isCancelled) {
      throw new Error('Cannot update a cancelled securities payment');
    }

    // Check payment number uniqueness if changing
    if (data.paymentNumber && data.paymentNumber !== payment.paymentNumber) {
      const existing = await prisma.securitiesPayment.findFirst({
        where: {
          companyId,
          paymentNumber: data.paymentNumber,
          id: { not: paymentId },
        },
      });

      if (existing) {
        throw new Error('Payment number already exists');
      }
    }

    const updateData: any = {};
    if (data.branchId !== undefined) updateData.branchId = data.branchId;
    if (data.serial !== undefined) updateData.serial = data.serial;
    if (data.paymentNumber !== undefined) updateData.paymentNumber = data.paymentNumber;
    if (data.date !== undefined) updateData.date = data.date;
    if (data.hijriDate !== undefined) updateData.hijriDate = data.hijriDate;
    if (data.description !== undefined) updateData.description = data.description;
    if (data.securityType !== undefined) updateData.securityType = data.securityType;
    if (data.customerId !== undefined) updateData.customerId = data.customerId;
    if (data.supplierId !== undefined) updateData.supplierId = data.supplierId;
    if (data.destinationAccountId !== undefined) updateData.destinationAccountId = data.destinationAccountId;
    if (data.payeeName !== undefined) updateData.payeeName = data.payeeName;
    if (data.payeeBank !== undefined) updateData.payeeBank = data.payeeBank;
    if (data.securityNumber !== undefined) updateData.securityNumber = data.securityNumber;
    if (data.dueDate !== undefined) updateData.dueDate = data.dueDate;
    if (data.amount !== undefined) updateData.amount = new Decimal(data.amount);
    if (data.currencyCode !== undefined) updateData.currencyCode = data.currencyCode;
    if (data.entityName !== undefined) updateData.entityName = data.entityName;

    return prisma.securitiesPayment.update({
      where: { id: paymentId },
      data: updateData,
      include: {
        customer: true,
        supplier: true,
      },
    });
  }

  /**
   * Post a securities payment (H11): issuing a check/promissory-note/bond to a
   * supplier or customer settles their AP/AR balance using a "notes payable"
   * liability (reusing the Cheque module's account) instead of cash — and must
   * post a real, reversible journal entry rather than just flipping a flag.
   */
  async postSecuritiesPayment(companyId: string, paymentId: string, ctx: SecuritiesPostingCtx) {
    const payment = await this.getSecuritiesPaymentById(companyId, paymentId);

    if (payment.isCancelled) {
      throw new Error('Cannot post a cancelled securities payment');
    }

    if (payment.isPosted) {
      throw new Error('Securities payment is already posted');
    }

    if (!payment.customerId && !payment.supplierId && !payment.destinationAccountId) {
      throw new AppError(422, 'اختر العميل أو حساباً آخر قبل ترحيل الورقة');
    }

    const amount = Number(payment.amount);
    const fiscalYearId = await fiscalYearService.assertOpenForDate(companyId, payment.date);
    const chequeAccounts = await treasuryAccountResolverService.resolveChequeAccounts(companyId);
    const partyAccountId = await treasuryAccountResolverService.resolvePartyAccountId({
      companyId,
      customerId: payment.customerId,
      supplierId: payment.supplierId,
      offsetAccountId: payment.destinationAccountId,
    });

    const posted = await prisma.$transaction(async (tx) => {
      const je = await journalPostingService.createAndPostInTx(
        tx,
        { companyId, branchId: ctx.branchId ?? '', fiscalYearId, userId: ctx.userId },
        {
          fiscalYearId,
          date: payment.date,
          description:
            payment.description ??
            `Securities payment ${payment.paymentNumber ?? payment.id.slice(0, 8)} (${payment.securityType})`,
          currencyCode: payment.currencyCode,
          entryType: 'SecuritiesPayment',
          sourceType: 'SECP',
          sourceNumber: payment.paymentNumber ?? payment.id,
          lines: [
            { accountId: partyAccountId, debit: amount, credit: 0, lineOrder: 1 },
            {
              accountId: chequeAccounts.notesPayableAccountId,
              debit: 0,
              credit: amount,
              lineOrder: 2,
            },
          ],
        }
      );

      // Mirror treasury-posting.service's applyPaymentBalances direction convention.
      if (payment.customerId) {
        await tx.customer.update({
          where: { id: payment.customerId },
          data: { balance: { increment: new Decimal(amount) } },
        });
      }
      if (payment.supplierId) {
        await tx.supplier.update({
          where: { id: payment.supplierId },
          data: { balance: { decrement: new Decimal(amount) } },
        });
      }

      return tx.securitiesPayment.update({
        where: { id: paymentId },
        data: {
          isPosted: true,
          postedAt: new Date(),
          journalEntryId: je.id,
        },
      });
    });

    return posted;
  }

  /**
   * Unpost a securities payment (H11): reverses the posting journal entry via a
   * dated contra entry and restores the party balance, mirroring cheque unpost.
   */
  async unpostSecuritiesPayment(companyId: string, paymentId: string, ctx: SecuritiesPostingCtx) {
    const payment = await this.getSecuritiesPaymentById(companyId, paymentId);

    if (!payment.isPosted) {
      throw new Error('Securities payment is not posted');
    }

    const amount = Number(payment.amount);
    const fiscalYearId = await fiscalYearService.assertOpenForDate(companyId, new Date());

    return prisma.$transaction(async (tx) => {
      if (payment.journalEntryId) {
        await journalPostingService.reverseJournalEntryInTx(
          tx,
          { companyId, branchId: ctx.branchId ?? '', fiscalYearId, userId: ctx.userId },
          payment.journalEntryId,
          { reason: 'Securities payment unposted' }
        );
      }

      // Mirror treasury-posting.service's reversePaymentBalances direction convention.
      if (payment.customerId) {
        await tx.customer.update({
          where: { id: payment.customerId },
          data: { balance: { decrement: new Decimal(amount) } },
        });
      }
      if (payment.supplierId) {
        await tx.supplier.update({
          where: { id: payment.supplierId },
          data: { balance: { increment: new Decimal(amount) } },
        });
      }

      return tx.securitiesPayment.update({
        where: { id: paymentId },
        data: {
          isPosted: false,
          postedAt: null,
        },
      });
    });
  }

  /**
   * Bounce (ارتداد): reverse posting if needed, then cancel the paper.
   */
  async bounceSecuritiesPayment(
    companyId: string,
    paymentId: string,
    ctx: SecuritiesPostingCtx,
    description?: string
  ) {
    const payment = await this.getSecuritiesPaymentById(companyId, paymentId);
    if (payment.isCancelled) {
      throw new Error('Securities payment is already cancelled');
    }
    if (payment.isPosted) {
      await this.unpostSecuritiesPayment(companyId, paymentId, ctx);
    }
    if (description?.trim()) {
      const next = [payment.description, description.trim()].filter(Boolean).join(' — ');
      await prisma.securitiesPayment.update({
        where: { id: paymentId },
        data: { description: next },
      });
    }
    return this.cancelSecuritiesPayment(companyId, paymentId);
  }

  /**
   * Cancel a securities payment
   */
  async cancelSecuritiesPayment(companyId: string, paymentId: string) {
    const payment = await this.getSecuritiesPaymentById(companyId, paymentId);

    if (payment.isPosted) {
      throw new Error('Cannot cancel a posted securities payment. Unpost it first.');
    }

    if (payment.isCancelled) {
      throw new Error('Securities payment is already cancelled');
    }

    return prisma.securitiesPayment.update({
      where: { id: paymentId },
      data: {
        isCancelled: true,
        cancelledAt: new Date(),
      },
    });
  }

  /**
   * Restore a cancelled securities payment
   */
  async restoreSecuritiesPayment(companyId: string, paymentId: string) {
    const payment = await this.getSecuritiesPaymentById(companyId, paymentId);

    if (!payment.isCancelled) {
      throw new Error('Securities payment is not cancelled');
    }

    return prisma.securitiesPayment.update({
      where: { id: paymentId },
      data: {
        isCancelled: false,
        cancelledAt: null,
      },
    });
  }
}

export const securitiesPaymentService = new SecuritiesPaymentService();

