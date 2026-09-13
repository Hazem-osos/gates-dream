import prisma from '../../../shared/database/prisma';
import { logger } from '../../../shared/logger';
import { Decimal } from '@prisma/client/runtime/library';
import { autoGlPostingService } from '../../accounting/services/auto-gl-posting.service';
import { resolveDefaultTreasuryPostingContext } from '../../treasury/services/treasury-posting-context';

export interface CreateExtractPaymentData {
  extractId: string;
  contractorId?: string;
  projectId: string;
  paymentNumber?: string;
  paymentDate: Date;
  dueDate?: Date;
  safeId?: string;
  bankAccountId?: string;
  checkNumber?: string;
  checkDate?: Date;
  hijriDate?: string;
  description?: string;
  paymentAmount: number;
  itemGroup?: string;
  notes?: string;
}

export class ExtractPaymentService {
  async createExtractPayment(companyId: string, data: CreateExtractPaymentData) {
    try {
      // Verify extract and project exist
      const extract = await prisma.extract.findFirst({
        where: {
          id: data.extractId,
          project: { companyId },
        },
      });

      if (!extract) {
        throw new Error('Extract not found');
      }

      const payment = await prisma.$transaction(async (tx) => {
        const created = await tx.extractPayment.create({
          data: {
            extractId: data.extractId,
            contractorId: data.contractorId,
            projectId: data.projectId,
            paymentNumber: data.paymentNumber,
            paymentDate: data.paymentDate,
            dueDate: data.dueDate,
            safeId: data.safeId,
            bankAccountId: data.bankAccountId,
            checkNumber: data.checkNumber,
            checkDate: data.checkDate,
            hijriDate: data.hijriDate,
            description: data.description,
            paymentAmount: new Decimal(data.paymentAmount),
            itemGroup: data.itemGroup,
            notes: data.notes,
          },
        });

        if (await autoGlPostingService.isAutoPostEnabled(companyId)) {
          const ctx = await resolveDefaultTreasuryPostingContext(companyId, 'system', data.paymentDate);
          await autoGlPostingService.postDocument(tx, ctx, {
            sourceType: 'CONTRACTOR_EXTRACT_PAYMENT',
            sourceId: created.id,
          });
          await tx.extractPayment.update({
            where: { id: created.id },
            data: { isPosted: true },
          });
        }

        return tx.extractPayment.findFirst({
          where: { id: created.id },
          include: {
            extract: { include: { project: true } },
            contractor: true,
            project: true,
          },
        });
      });

      logger.info({ companyId, paymentId: payment?.id }, 'Extract payment created');
      return payment;
    } catch (error) {
      logger.error({ error, companyId }, 'Error creating extract payment');
      throw error;
    }
  }

  async listExtractPayments(
    companyId: string,
    options: {
      page?: number;
      limit?: number;
      extractId?: string;
      contractorId?: string;
      projectId?: string;
      fromDate?: Date;
      toDate?: Date;
    } = {}
  ) {
    try {
      const page = options.page || 1;
      const limit = options.limit || 50;
      const skip = (page - 1) * limit;

      const where: any = {
        project: { companyId },
      };

      if (options.extractId) where.extractId = options.extractId;
      if (options.contractorId) where.contractorId = options.contractorId;
      if (options.projectId) where.projectId = options.projectId;
      if (options.fromDate || options.toDate) {
        where.paymentDate = {};
        if (options.fromDate) where.paymentDate.gte = options.fromDate;
        if (options.toDate) where.paymentDate.lte = options.toDate;
      }

      const [payments, total] = await Promise.all([
        prisma.extractPayment.findMany({
          where,
          skip,
          take: limit,
          orderBy: { paymentDate: 'desc' },
          include: {
            extract: {
              select: {
                id: true,
                extractNumber: true,
                extractDate: true,
              },
            },
            contractor: {
              select: {
                id: true,
                arabicName: true,
                serial: true,
              },
            },
            project: {
              select: {
                id: true,
                arabicName: true,
                serial: true,
              },
            },
          },
        }),
        prisma.extractPayment.count({ where }),
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
    } catch (error) {
      logger.error({ error, companyId }, 'Error listing extract payments');
      throw error;
    }
  }

  async getExtractPaymentById(companyId: string, id: string) {
    try {
      const payment = await prisma.extractPayment.findFirst({
        where: {
          id,
          project: { companyId },
        },
        include: {
          extract: {
            include: {
              project: true,
              contractor: true,
            },
          },
          contractor: true,
          project: true,
        },
      });

      if (!payment) {
        throw new Error('Extract payment not found');
      }

      return payment;
    } catch (error) {
      logger.error({ error, companyId, paymentId: id }, 'Error getting extract payment');
      throw error;
    }
  }
}

export const extractPaymentService = new ExtractPaymentService();

