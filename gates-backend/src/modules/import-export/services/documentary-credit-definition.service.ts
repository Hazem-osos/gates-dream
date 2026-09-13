import prisma from '../../../shared/database/prisma';
import { logger } from '../../../shared/logger';
import { Decimal } from '@prisma/client/runtime/library';

export interface CreateDocumentaryCreditDefinitionData {
  serial?: string;
  supplierId?: string | null;
  supplierName?: string;
  description?: string;
  shippingPort?: string;
  creditValue?: number | null;
  creditNumber?: string;
  currencyId?: string | null;
  currencyName?: string;
  shippingMethod?: 'بحري' | 'جوي' | 'برى';
  paymentMethod?: 'فيزا' | 'شيك' | 'نقد';
  openingDate?: Date | string | null;
  openingDateHijri?: string;
  closingDate?: Date | string | null;
  closingDateHijri?: string;
  shippingDate?: Date | string | null;
  shippingDateHijri?: string;
}

export interface UpdateDocumentaryCreditDefinitionData extends Partial<CreateDocumentaryCreditDefinitionData> {
  isActive?: boolean;
}

export class DocumentaryCreditDefinitionService {
  async create(companyId: string, data: CreateDocumentaryCreditDefinitionData) {
    try {
      const definition = await prisma.documentaryCreditDefinition.create({
        data: {
          companyId,
          serial: data.serial,
          supplierId: data.supplierId,
          supplierName: data.supplierName,
          description: data.description,
          shippingPort: data.shippingPort,
          creditValue: data.creditValue ? new Decimal(data.creditValue) : null,
          creditNumber: data.creditNumber,
          currencyId: data.currencyId,
          currencyName: data.currencyName,
          shippingMethod: data.shippingMethod,
          paymentMethod: data.paymentMethod,
          openingDate: data.openingDate ? new Date(data.openingDate) : null,
          openingDateHijri: data.openingDateHijri,
          closingDate: data.closingDate ? new Date(data.closingDate) : null,
          closingDateHijri: data.closingDateHijri,
          shippingDate: data.shippingDate ? new Date(data.shippingDate) : null,
          shippingDateHijri: data.shippingDateHijri,
        },
      });

      logger.info({ companyId, definitionId: definition.id }, 'Documentary credit definition created');
      return definition;
    } catch (error) {
      logger.error({ error, companyId, data }, 'Error creating documentary credit definition');
      throw error;
    }
  }

  async getById(companyId: string, id: string) {
    try {
      const definition = await prisma.documentaryCreditDefinition.findFirst({
        where: { id, companyId },
      });

      if (!definition) {
        throw new Error('Documentary credit definition not found');
      }

      return definition;
    } catch (error) {
      logger.error({ error, companyId, id }, 'Error getting documentary credit definition');
      throw error;
    }
  }

  async list(companyId: string, options: { page?: number; limit?: number; search?: string } = {}) {
    try {
      const { page = 1, limit = 100, search } = options;
      const skip = (page - 1) * limit;

      const where: any = {
        companyId,

      };

      if (search) {
        where.OR = [
          { serial: { contains: search } },
          { supplierName: { contains: search } },
          { description: { contains: search } },
          { creditNumber: { contains: search } },
        ];
      }

      const [definitions, total] = await Promise.all([
        prisma.documentaryCreditDefinition.findMany({
          where,
          skip,
          take: limit,
          orderBy: { createdAt: 'desc' },
        }),
        prisma.documentaryCreditDefinition.count({ where }),
      ]);

      return {
        data: definitions,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      };
    } catch (error) {
      logger.error({ error, companyId, options }, 'Error listing documentary credit definitions');
      throw error;
    }
  }

  async update(companyId: string, id: string, data: UpdateDocumentaryCreditDefinitionData) {
    try {
      const existing = await prisma.documentaryCreditDefinition.findFirst({
        where: { id, companyId },
      });

      if (!existing) {
        throw new Error('Documentary credit definition not found');
      }

      const updateData: any = {};
      if (data.serial !== undefined) updateData.serial = data.serial;
      if (data.supplierId !== undefined) updateData.supplierId = data.supplierId;
      if (data.supplierName !== undefined) updateData.supplierName = data.supplierName;
      if (data.description !== undefined) updateData.description = data.description;
      if (data.shippingPort !== undefined) updateData.shippingPort = data.shippingPort;
      if (data.creditValue !== undefined) updateData.creditValue = data.creditValue ? new Decimal(data.creditValue) : null;
      if (data.creditNumber !== undefined) updateData.creditNumber = data.creditNumber;
      if (data.currencyId !== undefined) updateData.currencyId = data.currencyId;
      if (data.currencyName !== undefined) updateData.currencyName = data.currencyName;
      if (data.shippingMethod !== undefined) updateData.shippingMethod = data.shippingMethod;
      if (data.paymentMethod !== undefined) updateData.paymentMethod = data.paymentMethod;
      if (data.openingDate !== undefined) updateData.openingDate = data.openingDate ? new Date(data.openingDate) : null;
      if (data.openingDateHijri !== undefined) updateData.openingDateHijri = data.openingDateHijri;
      if (data.closingDate !== undefined) updateData.closingDate = data.closingDate ? new Date(data.closingDate) : null;
      if (data.closingDateHijri !== undefined) updateData.closingDateHijri = data.closingDateHijri;
      if (data.shippingDate !== undefined) updateData.shippingDate = data.shippingDate ? new Date(data.shippingDate) : null;
      if (data.shippingDateHijri !== undefined) updateData.shippingDateHijri = data.shippingDateHijri;
      if (data.isActive !== undefined) updateData.isActive = data.isActive;

      const definition = await prisma.documentaryCreditDefinition.update({
        where: { id },
        data: updateData,
      });

      logger.info({ companyId, id }, 'Documentary credit definition updated');
      return definition;
    } catch (error) {
      logger.error({ error, companyId, id, data }, 'Error updating documentary credit definition');
      throw error;
    }
  }

  async delete(companyId: string, id: string) {
    try {
      const existing = await prisma.documentaryCreditDefinition.findFirst({
        where: { id, companyId },
      });

      if (!existing) {
        throw new Error('Documentary credit definition not found');
      }

      await prisma.documentaryCreditDefinition.update({
        where: { id },
        data: { isActive: false },
      });

      logger.info({ companyId, id }, 'Documentary credit definition deleted');
    } catch (error) {
      logger.error({ error, companyId, id }, 'Error deleting documentary credit definition');
      throw error;
    }
  }
}

export const documentaryCreditDefinitionService = new DocumentaryCreditDefinitionService();

