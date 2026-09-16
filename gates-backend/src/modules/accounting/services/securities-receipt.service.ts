import prisma from '../../../shared/database/prisma';
import { logger } from '../../../shared/logger';
import { Decimal } from '@prisma/client/runtime/library';
import { documentSequenceService } from '../../platform/services/document-sequence.service';
import { AppError } from '../../../shared/middleware/error-handler';
import { journalPostingService } from './journal-posting.service';
import { fiscalYearService } from '../../platform/services/fiscal-year.service';
import { treasuryAccountResolverService } from '../../treasury/services/treasury-account-resolver.service';
import { commercialPaperPostingService } from './commercial-paper-posting.service';
import { resolveCompanyFxRate, toBaseAmount } from '../utils/company-fx-rate';

/** Minimal context needed to post a real GL entry for a securities receipt (H11). */
export interface SecuritiesPostingCtx {
  branchId?: string | null;
  userId: string;
}

export interface CreateSecuritiesReceiptData {
  branchId?: string;
  serial?: string;
  receiptNumber?: string;
  date: Date;
  hijriDate?: string;
  description?: string;
  securityType: 'check' | 'promissory-note' | 'bond' | 'other';
  customerId?: string;
  supplierId?: string;
  destinationAccountId?: string | null;
  issuerName?: string;
  issuerBank?: string;
  securityNumber?: string;
  dueDate?: Date;
  amount: number;
  currencyCode: string;
  entityName?: string | null;
}

export interface UpdateSecuritiesReceiptData {
  branchId?: string;
  serial?: string;
  receiptNumber?: string;
  date?: Date;
  hijriDate?: string;
  description?: string;
  securityType?: 'check' | 'promissory-note' | 'bond' | 'other';
  customerId?: string;
  supplierId?: string;
  destinationAccountId?: string | null;
  issuerName?: string;
  issuerBank?: string;
  securityNumber?: string;
  dueDate?: Date;
  amount?: number;
  currencyCode?: string;
  entityName?: string | null;
}

export class SecuritiesReceiptService {
  /**
   * Get all securities receipts for a company
   */
  async getSecuritiesReceipts(
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

    const [receipts, total] = await Promise.all([
      prisma.securitiesReceipt.findMany({
        where,
        skip,
        take: limit,
        orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
        include: {
          customer: { select: { id: true, arabicName: true, code: true } },
          supplier: { select: { id: true, arabicName: true, code: true } },
        },
      }),
      prisma.securitiesReceipt.count({ where }),
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
   * Get a single securities receipt by ID
   */
  async getSecuritiesReceiptById(companyId: string, receiptId: string) {
    const receipt = await prisma.securitiesReceipt.findFirst({
      where: {
        id: receiptId,
        companyId,
      },
      include: {
        customer: true,
        supplier: true,
      },
    });

    if (!receipt) {
      throw new Error('Securities receipt not found');
    }

    const multiCollectionLines = await commercialPaperPostingService.listLines(
      companyId,
      'RECEIPT',
      receiptId
    );
    return { ...receipt, multiCollectionLines };
  }

  /**
   * Create a new securities receipt
   */
  async createSecuritiesReceipt(companyId: string, data: CreateSecuritiesReceiptData) {
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

    // Check receipt number uniqueness
    if (data.receiptNumber) {
      const existing = await prisma.securitiesReceipt.findFirst({
        where: {
          companyId,
          receiptNumber: data.receiptNumber,
        },
      });

      if (existing) {
        throw new Error('Receipt number already exists');
      }
    }

    // Legacy `CreateCKNum` numbers the received-securities voucher.
    const receiptNumber =
      data.receiptNumber?.trim() ||
      (await documentSequenceService.nextNumberForFamily({
        companyId,
        branchId: data.branchId ?? null,
        fiscalYearId: null,
        docType: 'CK',
        legacySuffix: 'CK01',
        seedFromExisting: documentSequenceService.maxExistingNumber(async () => {
          const rows = await prisma.securitiesReceipt.findMany({
            where: { companyId },
            select: { receiptNumber: true },
          });
          return rows.map((r) => r.receiptNumber);
        }),
        isAvailable: async (candidate) => {
          const taken = await prisma.securitiesReceipt.findFirst({
            where: { companyId, receiptNumber: candidate },
            select: { id: true },
          });
          return !taken;
        },
      })) ||
      null;

    return prisma.securitiesReceipt.create({
      data: {
        companyId,
        branchId: data.branchId,
        serial: data.serial,
        receiptNumber,
        date: data.date,
        hijriDate: data.hijriDate,
        description: data.description,
        securityType: data.securityType,
        customerId: data.customerId,
        supplierId: data.supplierId,
        destinationAccountId: data.destinationAccountId,
        issuerName: data.issuerName,
        issuerBank: data.issuerBank,
        securityNumber: data.securityNumber,
        dueDate: data.dueDate,
        amount: new Decimal(data.amount),
        currencyCode: data.currencyCode,
        entityName: data.entityName,
        isReceived: true,
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
   * Update a securities receipt
   */
  async updateSecuritiesReceipt(
    companyId: string,
    receiptId: string,
    data: UpdateSecuritiesReceiptData
  ) {
    const receipt = await this.getSecuritiesReceiptById(companyId, receiptId);

    if (receipt.isPosted) {
      throw new Error('Cannot update a posted securities receipt');
    }

    if (receipt.isCancelled) {
      throw new Error('Cannot update a cancelled securities receipt');
    }

    // Check receipt number uniqueness if changing
    if (data.receiptNumber && data.receiptNumber !== receipt.receiptNumber) {
      const existing = await prisma.securitiesReceipt.findFirst({
        where: {
          companyId,
          receiptNumber: data.receiptNumber,
          id: { not: receiptId },
        },
      });

      if (existing) {
        throw new Error('Receipt number already exists');
      }
    }

    const updateData: any = {};
    if (data.branchId !== undefined) updateData.branchId = data.branchId;
    if (data.serial !== undefined) updateData.serial = data.serial;
    if (data.receiptNumber !== undefined) updateData.receiptNumber = data.receiptNumber;
    if (data.date !== undefined) updateData.date = data.date;
    if (data.hijriDate !== undefined) updateData.hijriDate = data.hijriDate;
    if (data.description !== undefined) updateData.description = data.description;
    if (data.securityType !== undefined) updateData.securityType = data.securityType;
    if (data.customerId !== undefined) updateData.customerId = data.customerId;
    if (data.supplierId !== undefined) updateData.supplierId = data.supplierId;
    if (data.destinationAccountId !== undefined) updateData.destinationAccountId = data.destinationAccountId;
    if (data.issuerName !== undefined) updateData.issuerName = data.issuerName;
    if (data.issuerBank !== undefined) updateData.issuerBank = data.issuerBank;
    if (data.securityNumber !== undefined) updateData.securityNumber = data.securityNumber;
    if (data.dueDate !== undefined) updateData.dueDate = data.dueDate;
    if (data.amount !== undefined) updateData.amount = new Decimal(data.amount);
    if (data.currencyCode !== undefined) updateData.currencyCode = data.currencyCode;
    if (data.entityName !== undefined) updateData.entityName = data.entityName;

    return prisma.securitiesReceipt.update({
      where: { id: receiptId },
      data: updateData,
      include: {
        customer: true,
        supplier: true,
      },
    });
  }

  /**
   * Post a securities receipt (H11): receiving a check/promissory-note/bond from a
   * customer or supplier is a real accounting event — the instrument sits as an
   * asset ("notes in hand", reusing the Cheque module's account) until collected,
   * and the party's AR/AP balance is settled by it just as a cheque would.
   * Posts a real, reversible 2-line journal instead of flipping a flag.
   */
  async postSecuritiesReceipt(companyId: string, receiptId: string, ctx: SecuritiesPostingCtx) {
    const receipt = await this.getSecuritiesReceiptById(companyId, receiptId);

    if (receipt.isCancelled) {
      throw new Error('Cannot post a cancelled securities receipt');
    }

    if (receipt.isPosted) {
      throw new Error('Securities receipt is already posted');
    }

    if (!receipt.customerId && !receipt.supplierId && !receipt.destinationAccountId) {
      throw new AppError(422, 'اختر العميل أو حساباً آخر قبل ترحيل الورقة');
    }

    const amount = Number(receipt.amount);
    const { exchangeRate } = await resolveCompanyFxRate(companyId, receipt.currencyCode);
    const baseAmount = toBaseAmount(amount, exchangeRate);
    const fiscalYearId = await fiscalYearService.assertOpenForDate(companyId, receipt.date);
    const chequeAccounts = await treasuryAccountResolverService.resolveChequeAccounts(companyId);
    const partyAccountId = await treasuryAccountResolverService.resolvePartyAccountId({
      companyId,
      customerId: receipt.customerId,
      supplierId: receipt.supplierId,
      offsetAccountId: receipt.destinationAccountId,
    });

    const posted = await prisma.$transaction(async (tx) => {
      const je = await journalPostingService.createAndPostInTx(
        tx,
        { companyId, branchId: ctx.branchId ?? '', fiscalYearId, userId: ctx.userId },
        {
          fiscalYearId,
          date: receipt.date,
          description:
            receipt.description ??
            `Securities receipt ${receipt.receiptNumber ?? receipt.id.slice(0, 8)} (${receipt.securityType})`,
          currencyCode: receipt.currencyCode,
          exchangeRate,
          entryType: 'SecuritiesReceipt',
          sourceType: 'SECR',
          sourceNumber: receipt.receiptNumber ?? receipt.id,
          lines: [
            {
              accountId: chequeAccounts.chequesUnderHandAccountId,
              debit: amount,
              credit: 0,
              lineOrder: 1,
            },
            { accountId: partyAccountId, debit: 0, credit: amount, lineOrder: 2 },
          ],
        }
      );

      // Mirror treasury-posting.service's applyReceiptBalances direction convention.
      if (receipt.customerId) {
        await tx.customer.update({
          where: { id: receipt.customerId },
          data: { balance: { decrement: new Decimal(baseAmount) } },
        });
      }
      if (receipt.supplierId) {
        await tx.supplier.update({
          where: { id: receipt.supplierId },
          data: { balance: { increment: new Decimal(baseAmount) } },
        });
      }

      return tx.securitiesReceipt.update({
        where: { id: receiptId },
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
   * Unpost a securities receipt (H11): reverses the posting journal entry via a
   * dated contra entry and restores the party balance, mirroring cheque unpost.
   */
  async unpostSecuritiesReceipt(companyId: string, receiptId: string, ctx: SecuritiesPostingCtx) {
    const receipt = await this.getSecuritiesReceiptById(companyId, receiptId);

    if (!receipt.isPosted) {
      throw new Error('Securities receipt is not posted');
    }

    const amount = Number(receipt.amount);
    const { exchangeRate } = await resolveCompanyFxRate(companyId, receipt.currencyCode);
    const baseAmount = toBaseAmount(amount, exchangeRate);
    const fiscalYearId = await fiscalYearService.assertOpenForDate(companyId, new Date());

    return prisma.$transaction(async (tx) => {
      if (receipt.journalEntryId) {
        await journalPostingService.reverseJournalEntryInTx(
          tx,
          { companyId, branchId: ctx.branchId ?? '', fiscalYearId, userId: ctx.userId },
          receipt.journalEntryId,
          { reason: 'Securities receipt unposted' }
        );
      }

      // Mirror treasury-posting.service's reverseReceiptBalances direction convention.
      if (receipt.customerId) {
        await tx.customer.update({
          where: { id: receipt.customerId },
          data: { balance: { increment: new Decimal(baseAmount) } },
        });
      }
      if (receipt.supplierId) {
        await tx.supplier.update({
          where: { id: receipt.supplierId },
          data: { balance: { decrement: new Decimal(baseAmount) } },
        });
      }

      return tx.securitiesReceipt.update({
        where: { id: receiptId },
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
  async bounceSecuritiesReceipt(
    companyId: string,
    receiptId: string,
    ctx: SecuritiesPostingCtx,
    description?: string
  ) {
    const receipt = await this.getSecuritiesReceiptById(companyId, receiptId);
    if (receipt.isCancelled) {
      throw new Error('Securities receipt is already cancelled');
    }
    if (receipt.isPosted) {
      await this.unpostSecuritiesReceipt(companyId, receiptId, ctx);
    }
    if (description?.trim()) {
      const next = [receipt.description, description.trim()].filter(Boolean).join(' — ');
      await prisma.securitiesReceipt.update({
        where: { id: receiptId },
        data: { description: next },
      });
    }
    return this.cancelSecuritiesReceipt(companyId, receiptId);
  }

  /**
   * Endorse (تظهير) an unposted receipt paper to a supplier.
   */
  async endorseSecuritiesReceipt(
    companyId: string,
    receiptId: string,
    input: { supplierId: string; description?: string }
  ) {
    const receipt = await this.getSecuritiesReceiptById(companyId, receiptId);
    if (receipt.isCancelled) {
      throw new Error('Cannot endorse a cancelled securities receipt');
    }
    if (receipt.isPosted) {
      throw new Error('Unpost the securities receipt before endorsing it');
    }
    const supplier = await prisma.supplier.findFirst({
      where: { id: input.supplierId, companyId },
      select: { id: true, arabicName: true },
    });
    if (!supplier) {
      throw new Error('Supplier not found');
    }
    const note = input.description?.trim();
    return prisma.securitiesReceipt.update({
      where: { id: receiptId },
      data: {
        supplierId: supplier.id,
        issuerName: supplier.arabicName ?? receipt.issuerName,
        description: note
          ? [receipt.description, `تظهير إلى ${supplier.arabicName}: ${note}`].filter(Boolean).join(' — ')
          : receipt.description,
      },
      include: { customer: true, supplier: true },
    });
  }

  /**
   * Cancel a securities receipt
   */
  async cancelSecuritiesReceipt(companyId: string, receiptId: string) {
    const receipt = await this.getSecuritiesReceiptById(companyId, receiptId);

    if (receipt.isPosted) {
      throw new Error('Cannot cancel a posted securities receipt. Unpost it first.');
    }

    if (receipt.isCancelled) {
      throw new Error('Securities receipt is already cancelled');
    }

    return prisma.$transaction(async (tx) => {
      await journalPostingService.cascadeSourceJournalInTx(
        tx,
        companyId,
        [receipt.journalEntryId],
        'cancel',
        undefined,
        { sourceId: receipt.id, sourceNumber: receipt.receiptNumber ?? receipt.serial ?? undefined }
      );
      return tx.securitiesReceipt.update({
        where: { id: receiptId },
        data: {
          isCancelled: true,
          cancelledAt: new Date(),
        },
      });
    });
  }

  /**
   * Restore a cancelled securities receipt
   */
  async restoreSecuritiesReceipt(companyId: string, receiptId: string) {
    const receipt = await this.getSecuritiesReceiptById(companyId, receiptId);

    if (!receipt.isCancelled) {
      throw new Error('Securities receipt is not cancelled');
    }

    return prisma.securitiesReceipt.update({
      where: { id: receiptId },
      data: {
        isCancelled: false,
        cancelledAt: null,
      },
    });
  }
}

export const securitiesReceiptService = new SecuritiesReceiptService();

