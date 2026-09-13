import prisma from '../../../shared/database/prisma';
import { logger } from '../../../shared/logger';
import { Decimal } from '@prisma/client/runtime/library';
import { CreateOtherAdditionDiscountTypeInput, UpdateOtherAdditionDiscountTypeInput } from '../schemas/other-addition-discount-type.schema';

export class OtherAdditionDiscountTypeService {
  /**
   * Create a new other addition/discount type
   */
  async createOtherAdditionDiscountType(
    companyId: string,
    data: CreateOtherAdditionDiscountTypeInput
  ) {
    try {
      const otherType = await prisma.otherAdditionDiscountType.create({
        data: {
          companyId,
          serial: data.serial,
          name: data.name,
          accountId: data.accountId,
          offsetAccountId: data.offsetAccountId ?? null,
          abbreviation: data.abbreviation,
          isActive: data.isActive ?? true,
          base: data.base,
          type: data.type,
          percentages: {
            create: data.percentages?.map((p) => ({
              source: p.source,
              sourceId: p.sourceId,
              sourceName: p.sourceName ?? null,
              percentage: new Decimal(p.percentage),
            })) || [],
          },
        },
        include: {
          percentages: true,
        },
      });

      logger.info(
        { companyId, otherTypeId: otherType.id },
        'Other addition/discount type created'
      );
      return otherType;
    } catch (error) {
      logger.error(
        { error, companyId, data },
        'Error creating other addition/discount type'
      );
      throw error;
    }
  }

  /**
   * Get other addition/discount type by ID
   */
  async getOtherAdditionDiscountTypeById(companyId: string, typeId: string) {
    try {
      const otherType = await prisma.otherAdditionDiscountType.findFirst({
        where: {
          id: typeId,
          companyId,
        },
        include: {
          percentages: true,
        },
      });

      if (!otherType) {
        throw new Error('Other addition/discount type not found');
      }

      return otherType;
    } catch (error) {
      logger.error(
        { error, companyId, typeId },
        'Error getting other addition/discount type'
      );
      throw error;
    }
  }

  /**
   * List other addition/discount types with pagination and filters
   */
  async listOtherAdditionDiscountTypes(
    companyId: string,
    options: {
      page?: number;
      limit?: number;
      search?: string;
      type?: string; // 'addition' | 'discount'
      isActive?: boolean;
    }
  ) {
    try {
      const page = options.page || 1;
      const limit = options.limit || 50;
      const skip = (page - 1) * limit;

      const where: any = {
        companyId,
      };

      if (options.isActive !== undefined) {
        where.isActive = options.isActive;
      }

      if (options.type) {
        where.type = options.type;
      }

      if (options.search) {
        where.OR = [
          { name: { contains: options.search } },
          { abbreviation: { contains: options.search } },
          { serial: { contains: options.search } },
        ];
      }

      const [types, total] = await Promise.all([
        prisma.otherAdditionDiscountType.findMany({
          where,
          skip,
          take: limit,
          orderBy: { createdAt: 'desc' },
          include: {
            percentages: true,
          },
        }),
        prisma.otherAdditionDiscountType.count({ where }),
      ]);

      return {
        types,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      };
    } catch (error) {
      logger.error(
        { error, companyId, options },
        'Error listing other addition/discount types'
      );
      throw error;
    }
  }

  /**
   * Update other addition/discount type
   */
  async updateOtherAdditionDiscountType(
    companyId: string,
    typeId: string,
    data: UpdateOtherAdditionDiscountTypeInput
  ) {
    try {
      const existing = await prisma.otherAdditionDiscountType.findFirst({
        where: {
          id: typeId,
          companyId,
        },
      });

      if (!existing) {
        throw new Error('Other addition/discount type not found');
      }

      const updateData: any = {};

      if (data.serial !== undefined) updateData.serial = data.serial;
      if (data.name !== undefined) updateData.name = data.name;
      if (data.accountId !== undefined) updateData.accountId = data.accountId;
      if (data.offsetAccountId !== undefined) updateData.offsetAccountId = data.offsetAccountId;
      if (data.abbreviation !== undefined) updateData.abbreviation = data.abbreviation;
      if (data.isActive !== undefined) updateData.isActive = data.isActive;
      if (data.base !== undefined) updateData.base = data.base;
      if (data.type !== undefined) updateData.type = data.type;

      // Handle percentages update
      if (data.percentages !== undefined) {
        // Delete existing percentages
        await prisma.otherAdditionDiscountPercentage.deleteMany({
          where: { otherAdditionDiscountTypeId: typeId },
        });

        // Create new percentages
        updateData.percentages = {
          create: data.percentages.map((p) => ({
            source: p.source,
            sourceId: p.sourceId,
            sourceName: p.sourceName ?? null,
            percentage: new Decimal(p.percentage),
          })),
        };
      }

      const otherType = await prisma.otherAdditionDiscountType.update({
        where: { id: typeId },
        data: updateData,
        include: {
          percentages: true,
        },
      });

      logger.info({ companyId, typeId }, 'Other addition/discount type updated');
      return otherType;
    } catch (error) {
      logger.error(
        { error, companyId, typeId, data },
        'Error updating other addition/discount type'
      );
      throw error;
    }
  }

  /**
   * Delete other addition/discount type
   */
  async deleteOtherAdditionDiscountType(companyId: string, typeId: string) {
    try {
      const otherType = await prisma.otherAdditionDiscountType.findFirst({
        where: {
          id: typeId,
          companyId,
        },
      });

      if (!otherType) {
        throw new Error('Other addition/discount type not found');
      }

      await prisma.otherAdditionDiscountType.delete({
        where: { id: typeId },
      });

      logger.info({ companyId, typeId }, 'Other addition/discount type deleted');
      return { success: true };
    } catch (error) {
      logger.error(
        { error, companyId, typeId },
        'Error deleting other addition/discount type'
      );
      throw error;
    }
  }
}

export const otherAdditionDiscountTypeService = new OtherAdditionDiscountTypeService();

