import prisma from '../../../shared/database/prisma';
import { Decimal } from '@prisma/client/runtime/library';
import { AppError } from '../../../shared/middleware/error-handler';
import { documentSequenceService } from '../../platform/services/document-sequence.service';
import { journalPostingService } from './journal-posting.service';
import { commercialPaperPostingService } from './commercial-paper-posting.service';
import {
  assertPaperIssued,
  SECURITIES_PAPER_CASES,
} from '../utils/securities-paper-case';
import { resolveSecuritiesPaperNumbers } from '../utils/securities-numbering';
import { resolveSecuritiesEntity } from './securities-entity.service';
import type { CollectSecuritiesInput } from './securities-receipt.service';

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
  entityId?: string | null;
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
  entityId?: string | null;
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
      entityId?: string;
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
    if (options?.entityId) {
      where.entityId = options.entityId;
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
          entity: { select: { id: true, arabicName: true } },
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
  async getSecuritiesPaymentById(
    companyId: string,
    paymentId: string,
    ctx?: SecuritiesPostingCtx
  ) {
    const payment = await prisma.securitiesPayment.findFirst({
      where: {
        id: paymentId,
        companyId,
      },
      include: {
        customer: true,
        supplier: true,
        entity: { select: { id: true, arabicName: true } },
      },
    });

    if (!payment) {
      throw new AppError(404, 'ورقة المدفوعات غير موجودة');
    }

    if (ctx?.userId) {
      return commercialPaperPostingService.ensureIssueJournalIfMissing(
        { companyId, branchId: ctx.branchId ?? payment.branchId, userId: ctx.userId },
        'PAYMENT',
        paymentId
      );
    }
    return commercialPaperPostingService.decoratePaper(companyId, 'PAYMENT', payment);
  }

  /**
   * Create a new securities payment
   */
  async createSecuritiesPayment(
    companyId: string,
    data: CreateSecuritiesPaymentData,
    ctx?: SecuritiesPostingCtx
  ) {
    if (!data.customerId && !data.supplierId) {
      throw new AppError(422, 'اختر المورد قبل حفظ ورقة المدفوعات');
    }
    const destinationAccountId =
      data.destinationAccountId ||
      (await commercialPaperPostingService.resolveDefaultNotesAccount(companyId, 'PAYMENT'));
    const account = await prisma.account.findFirst({
      where: { id: destinationAccountId, companyId, deletedAt: null },
      select: { id: true },
    });
    if (!account) throw new AppError(400, 'الحساب المختار غير موجود');

    const { serial, documentNumber: paymentNumber } = await resolveSecuritiesPaperNumbers({
      companyId,
      kind: 'PAYMENT',
      serial: data.serial,
      documentNumber: data.paymentNumber,
      allocate: () =>
        documentSequenceService.nextNumberForFamily({
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
        }),
    });

    const existing = await prisma.securitiesPayment.findFirst({
      where: { companyId, paymentNumber },
      select: { id: true },
    });
    if (existing) {
      throw new Error('Payment number already exists');
    }

    const entity = await resolveSecuritiesEntity(companyId, {
      entityId: data.entityId,
      entityName: data.entityName,
    });

    const created = await prisma.securitiesPayment.create({
      data: {
        companyId,
        branchId: data.branchId ?? ctx?.branchId,
        serial,
        paymentNumber,
        date: data.date,
        hijriDate: data.hijriDate,
        description: data.description,
        securityType: data.securityType,
        customerId: data.customerId,
        supplierId: data.supplierId,
        destinationAccountId,
        payeeName: data.payeeName,
        payeeBank: data.payeeBank,
        securityNumber: data.securityNumber,
        dueDate: data.dueDate,
        amount: new Decimal(data.amount),
        currencyCode: data.currencyCode,
        entityId: entity?.id,
        entityName: entity?.arabicName ?? data.entityName,
        isPaid: true,
        isPosted: false,
        isApproved: false,
        isCancelled: false,
        paperCase: SECURITIES_PAPER_CASES.ISSUED,
      },
    });
    if (!ctx?.userId) {
      return commercialPaperPostingService.decoratePaper(companyId, 'PAYMENT', created);
    }
    try {
      return await commercialPaperPostingService.syncIssueJournal(
        { companyId, branchId: ctx.branchId ?? data.branchId ?? created.branchId, userId: ctx.userId },
        'PAYMENT',
        created.id
      );
    } catch (error) {
      await prisma.securitiesPayment.delete({ where: { id: created.id } }).catch(() => undefined);
      throw error;
    }
  }

  /**
   * Update a securities payment
   */
  async updateSecuritiesPayment(
    companyId: string,
    paymentId: string,
    data: UpdateSecuritiesPaymentData,
    ctx?: SecuritiesPostingCtx
  ) {
    const payment = await this.getSecuritiesPaymentById(companyId, paymentId);

    if (payment.isPosted) {
      throw new AppError(400, 'فك الترحيل أولاً قبل تعديل الورقة');
    }
    if (payment.isCancelled) {
      throw new AppError(400, 'لا يمكن تعديل ورقة ملغاة');
    }
    assertPaperIssued(payment, 'تعديل الورقة');

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
    if (data.entityId !== undefined || data.entityName !== undefined) {
      const entity = await resolveSecuritiesEntity(companyId, {
        entityId: data.entityId,
        entityName: data.entityName,
      });
      updateData.entityId = entity?.id ?? null;
      updateData.entityName = entity?.arabicName ?? data.entityName ?? null;
    }

    const updated = await prisma.securitiesPayment.update({
      where: { id: paymentId },
      data: updateData,
      include: { customer: true, supplier: true, entity: { select: { id: true, arabicName: true } } },
    });
    if (!ctx?.userId) {
      return commercialPaperPostingService.decoratePaper(companyId, 'PAYMENT', updated);
    }
    return commercialPaperPostingService.syncIssueJournal(
      { companyId, branchId: ctx.branchId ?? payment.branchId, userId: ctx.userId },
      'PAYMENT',
      paymentId
    );
  }

  async postSecuritiesPayment(companyId: string, paymentId: string, ctx: SecuritiesPostingCtx) {
    return commercialPaperPostingService.postPaper(
      { companyId, branchId: ctx.branchId, userId: ctx.userId },
      'PAYMENT',
      paymentId
    );
  }

  async collectSecuritiesPayment(
    companyId: string,
    paymentId: string,
    ctx: SecuritiesPostingCtx,
    input: CollectSecuritiesInput
  ) {
    return commercialPaperPostingService.collectPaper(
      { companyId, branchId: ctx.branchId, userId: ctx.userId },
      'PAYMENT',
      paymentId,
      input
    );
  }

  async unpostSecuritiesPayment(companyId: string, paymentId: string, ctx: SecuritiesPostingCtx) {
    return commercialPaperPostingService.unpostPaper(
      { companyId, branchId: ctx.branchId, userId: ctx.userId },
      'PAYMENT',
      paymentId
    );
  }

  async bounceSecuritiesPayment(
    companyId: string,
    paymentId: string,
    ctx: SecuritiesPostingCtx,
    input: { description?: string; date?: Date; accountId?: string } | string = {}
  ) {
    const body = typeof input === 'string' ? { description: input } : input;
    return commercialPaperPostingService.bouncePaper(
      { companyId, branchId: ctx.branchId, userId: ctx.userId },
      'PAYMENT',
      paymentId,
      body
    );
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

    return prisma.$transaction(async (tx) => {
      await journalPostingService.cascadeSourceJournalInTx(
        tx,
        companyId,
        [payment.journalEntryId],
        'cancel',
        undefined,
        { sourceId: payment.id, sourceNumber: payment.paymentNumber ?? payment.serial ?? undefined }
      );
      return tx.securitiesPayment.update({
        where: { id: paymentId },
        data: {
          isCancelled: true,
          cancelledAt: new Date(),
          paperCase: SECURITIES_PAPER_CASES.BOUNCED,
        },
      });
    });
  }

  /**
   * Restore a cancelled securities payment
   */
  async restoreSecuritiesPayment(companyId: string, paymentId: string, ctx: SecuritiesPostingCtx) {
    return commercialPaperPostingService.restorePaper(
      { companyId, branchId: ctx.branchId, userId: ctx.userId },
      'PAYMENT',
      paymentId
    );
  }
}

export const securitiesPaymentService = new SecuritiesPaymentService();

