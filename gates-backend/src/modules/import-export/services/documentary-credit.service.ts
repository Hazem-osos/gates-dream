import prisma from '../../../shared/database/prisma';
import { logger } from '../../../shared/logger';
import { Decimal } from '@prisma/client/runtime/library';

export interface CreateDocumentaryCreditData {
  definitionId?: string | null;
  serial?: string;
  supplierId?: string | null;
  supplierName?: string;
  accountId?: string | null;
  accountName?: string;
  costCenterId?: string | null;
  costCenterName?: string;
  description?: string;
  approvalStatus?: 'open' | 'closed';
  approvalNumber?: string;
  approvalValue?: number | null;
  currencyId?: string | null;
  currencyName?: string;
  shippingMethod?: 'بحري' | 'جوي' | 'برى';
  paymentMethod?: 'فيزا' | 'شيك' | 'نقد';
  applicationDate?: Date | string | null;
  applicationDateHijri?: string;
  openingDate?: Date | string | null;
  openingDateHijri?: string;
  closingDate?: Date | string | null;
  closingDateHijri?: string;
  shippingDate?: Date | string | null;
  shippingDateHijri?: string;
  arrivalDate?: Date | string | null;
  arrivalDateHijri?: string;
  shippingPort?: string;
  billOfLading?: string;
  taxEntryId?: string | null;
  entryId?: string | null;
}

export interface UpdateDocumentaryCreditData extends Partial<CreateDocumentaryCreditData> {
  isActive?: boolean;
}

export class DocumentaryCreditService {
  async create(companyId: string, data: CreateDocumentaryCreditData) {
    try {
      const credit = await prisma.documentaryCredit.create({
        data: {
          companyId,
          definitionId: data.definitionId,
          serial: data.serial,
          supplierId: data.supplierId,
          supplierName: data.supplierName,
          accountId: data.accountId,
          accountName: data.accountName,
          costCenterId: data.costCenterId,
          costCenterName: data.costCenterName,
          description: data.description,
          approvalStatus: data.approvalStatus || 'closed',
          approvalNumber: data.approvalNumber,
          approvalValue: data.approvalValue ? new Decimal(data.approvalValue) : null,
          currencyId: data.currencyId,
          currencyName: data.currencyName,
          shippingMethod: data.shippingMethod,
          paymentMethod: data.paymentMethod,
          applicationDate: data.applicationDate ? new Date(data.applicationDate) : null,
          applicationDateHijri: data.applicationDateHijri,
          openingDate: data.openingDate ? new Date(data.openingDate) : null,
          openingDateHijri: data.openingDateHijri,
          closingDate: data.closingDate ? new Date(data.closingDate) : null,
          closingDateHijri: data.closingDateHijri,
          shippingDate: data.shippingDate ? new Date(data.shippingDate) : null,
          shippingDateHijri: data.shippingDateHijri,
          arrivalDate: data.arrivalDate ? new Date(data.arrivalDate) : null,
          arrivalDateHijri: data.arrivalDateHijri,
          shippingPort: data.shippingPort,
          billOfLading: data.billOfLading,
          taxEntryId: data.taxEntryId,
          entryId: data.entryId,
        },
      });

      logger.info({ companyId, creditId: credit.id }, 'Documentary credit created');
      return credit;
    } catch (error) {
      logger.error({ error, companyId, data }, 'Error creating documentary credit');
      throw error;
    }
  }

  async getById(companyId: string, id: string) {
    try {
      const credit = await prisma.documentaryCredit.findFirst({
        where: { id, companyId },
        include: {
          definition: true,
        },
      });

      if (!credit) {
        throw new Error('Documentary credit not found');
      }

      return credit;
    } catch (error) {
      logger.error({ error, companyId, id }, 'Error getting documentary credit');
      throw error;
    }
  }

  async list(companyId: string, options: { page?: number; limit?: number; search?: string; approvalStatus?: string } = {}) {
    try {
      const { page = 1, limit = 100, search, approvalStatus } = options;
      const skip = (page - 1) * limit;

      const where: any = {
        companyId,

      };

      if (search) {
        where.OR = [
          { serial: { contains: search } },
          { supplierName: { contains: search } },
          { description: { contains: search } },
          { approvalNumber: { contains: search } },
        ];
      }

      if (approvalStatus) {
        where.approvalStatus = approvalStatus;
      }

      const [credits, total] = await Promise.all([
        prisma.documentaryCredit.findMany({
          where,
          skip,
          take: limit,
          orderBy: { createdAt: 'desc' },
          include: {
            definition: true,
          },
        }),
        prisma.documentaryCredit.count({ where }),
      ]);

      return {
        data: credits,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      };
    } catch (error) {
      logger.error({ error, companyId, options }, 'Error listing documentary credits');
      throw error;
    }
  }

  async update(companyId: string, id: string, data: UpdateDocumentaryCreditData) {
    try {
      const existing = await prisma.documentaryCredit.findFirst({
        where: { id, companyId },
      });

      if (!existing) {
        throw new Error('Documentary credit not found');
      }

      const updateData: any = {};
      Object.keys(data).forEach((key) => {
        if (data[key as keyof UpdateDocumentaryCreditData] !== undefined) {
          if (['approvalValue'].includes(key)) {
            updateData[key] = data[key as keyof UpdateDocumentaryCreditData] ? new Decimal(data[key as keyof UpdateDocumentaryCreditData] as number) : null;
          } else if (['applicationDate', 'openingDate', 'closingDate', 'shippingDate', 'arrivalDate'].includes(key)) {
            updateData[key] = data[key as keyof UpdateDocumentaryCreditData] ? new Date(data[key as keyof UpdateDocumentaryCreditData] as Date | string) : null;
          } else {
            updateData[key] = data[key as keyof UpdateDocumentaryCreditData];
          }
        }
      });

      const credit = await prisma.documentaryCredit.update({
        where: { id },
        data: updateData,
        include: {
          definition: true,
        },
      });

      logger.info({ companyId, id }, 'Documentary credit updated');
      return credit;
    } catch (error) {
      logger.error({ error, companyId, id, data }, 'Error updating documentary credit');
      throw error;
    }
  }

  async delete(companyId: string, id: string) {
    try {
      const existing = await prisma.documentaryCredit.findFirst({
        where: { id, companyId },
      });

      if (!existing) {
        throw new Error('Documentary credit not found');
      }

      await prisma.documentaryCredit.update({
        where: { id },
        data: { isActive: false },
      });

      logger.info({ companyId, id }, 'Documentary credit deleted');
    } catch (error) {
      logger.error({ error, companyId, id }, 'Error deleting documentary credit');
      throw error;
    }
  }
}

export const documentaryCreditService = new DocumentaryCreditService();

