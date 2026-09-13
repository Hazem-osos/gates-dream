import prisma from '../../../shared/database/prisma';
import { logger } from '../../../shared/logger';
import { Decimal } from '@prisma/client/runtime/library';

export interface CreateElectronicInvoiceItemData {
  itemId?: string;
  itemCode: string;
  arabicName: string;
  englishName?: string;
  unitCode?: string;
  unitName?: string;
  taxType?: string;
  taxRate?: number;
  price?: number;
  description?: string;
}

export class ElectronicInvoiceItemService {
  async createItem(companyId: string, data: CreateElectronicInvoiceItemData) {
    try {
      const item = await prisma.electronicInvoiceItem.create({
        data: {
          companyId,
          itemId: data.itemId,
          itemCode: data.itemCode,
          arabicName: data.arabicName,
          englishName: data.englishName,
          unitCode: data.unitCode,
          unitName: data.unitName,
          taxType: data.taxType,
          taxRate: data.taxRate ? new Decimal(data.taxRate) : null,
          price: data.price ? new Decimal(data.price) : null,
          description: data.description,
        },
        include: {
          item: {
            select: {
              id: true,
              arabicName: true,
              serial: true,
            },
          },
        },
      });

      logger.info({ companyId, itemId: item.id }, 'Electronic invoice item created');
      return item;
    } catch (error) {
      logger.error({ error, companyId }, 'Error creating electronic invoice item');
      throw error;
    }
  }

  async listItems(
    companyId: string,
    options: {
      page?: number;
      limit?: number;
      search?: string;
      isActive?: boolean;
    } = {}
  ) {
    try {
      const page = options.page || 1;
      const limit = options.limit || 50;
      const skip = (page - 1) * limit;

      const where: any = { companyId };

      if (options.isActive !== undefined) {
        where.isActive = options.isActive;
      }

      if (options.search) {
        where.OR = [
          { arabicName: { contains: options.search } },
          { englishName: { contains: options.search } },
          { itemCode: { contains: options.search } },
        ];
      }

      const [items, total] = await Promise.all([
        prisma.electronicInvoiceItem.findMany({
          where,
          skip,
          take: limit,
          orderBy: { createdAt: 'desc' },
          include: {
            item: {
              select: {
                id: true,
                arabicName: true,
                serial: true,
              },
            },
          },
        }),
        prisma.electronicInvoiceItem.count({ where }),
      ]);

      return {
        items,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      };
    } catch (error) {
      logger.error({ error, companyId }, 'Error listing electronic invoice items');
      throw error;
    }
  }

  async getItemById(companyId: string, id: string) {
    try {
      const item = await prisma.electronicInvoiceItem.findFirst({
        where: { id, companyId },
        include: {
          item: true,
        },
      });

      if (!item) {
        throw new Error('Electronic invoice item not found');
      }

      return item;
    } catch (error) {
      logger.error({ error, companyId, itemId: id }, 'Error getting electronic invoice item');
      throw error;
    }
  }

  async updateItem(companyId: string, id: string, data: Partial<CreateElectronicInvoiceItemData>) {
    try {
      const existing = await prisma.electronicInvoiceItem.findFirst({
        where: { id, companyId },
      });

      if (!existing) {
        throw new Error('Electronic invoice item not found');
      }

      const updateData: any = {};
      if (data.arabicName !== undefined) updateData.arabicName = data.arabicName;
      if (data.englishName !== undefined) updateData.englishName = data.englishName;
      if (data.itemCode !== undefined) updateData.itemCode = data.itemCode;
      if (data.unitCode !== undefined) updateData.unitCode = data.unitCode;
      if (data.unitName !== undefined) updateData.unitName = data.unitName;
      if (data.taxType !== undefined) updateData.taxType = data.taxType;
      if (data.taxRate !== undefined) updateData.taxRate = data.taxRate ? new Decimal(data.taxRate) : null;
      if (data.price !== undefined) updateData.price = data.price ? new Decimal(data.price) : null;
      if (data.description !== undefined) updateData.description = data.description;

      const item = await prisma.electronicInvoiceItem.update({
        where: { id },
        data: updateData,
      });

      logger.info({ companyId, itemId: id }, 'Electronic invoice item updated');
      return item;
    } catch (error) {
      logger.error({ error, companyId, itemId: id }, 'Error updating electronic invoice item');
      throw error;
    }
  }

  async deleteItem(companyId: string, id: string) {
    try {
      const item = await prisma.electronicInvoiceItem.findFirst({
        where: { id, companyId },
      });

      if (!item) {
        throw new Error('Electronic invoice item not found');
      }

      await prisma.electronicInvoiceItem.delete({
        where: { id },
      });

      logger.info({ companyId, itemId: id }, 'Electronic invoice item deleted');
    } catch (error) {
      logger.error({ error, companyId, itemId: id }, 'Error deleting electronic invoice item');
      throw error;
    }
  }
}

export const electronicInvoiceItemService = new ElectronicInvoiceItemService();

