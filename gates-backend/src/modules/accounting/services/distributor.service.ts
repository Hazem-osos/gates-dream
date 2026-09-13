import prisma from '../../../shared/database/prisma';
import { logger } from '../../../shared/logger';
import { CreateDistributorInput, UpdateDistributorInput } from '../schemas/distributor.schema';

export class DistributorService {
  /**
   * Create a new distributor
   */
  async createDistributor(companyId: string, data: CreateDistributorInput) {
    try {
      const distributor = await prisma.distributor.create({
        data: {
          companyId,
          serial: data.serial,
          arabicName: data.arabicName,
          englishName: data.englishName,
          nationality: data.nationality,
          barcode: data.barcode,
          phone1: data.phone1,
          phone2: data.phone2,
          mobile: data.mobile,
          fax: data.fax,
          email: data.email,
          website: data.website,
          country: data.country,
          city: data.city,
          area: data.area,
          street: data.street,
          postalCode: data.postalCode,
          poBox: data.poBox,
        },
      });

      logger.info({ companyId, distributorId: distributor.id }, 'Distributor created');
      return distributor;
    } catch (error) {
      logger.error({ error, companyId, data }, 'Error creating distributor');
      throw error;
    }
  }

  /**
   * Get distributor by ID
   */
  async getDistributorById(companyId: string, distributorId: string) {
    try {
      const distributor = await prisma.distributor.findFirst({
        where: {
          id: distributorId,
          companyId,

        },
      });

      if (!distributor) {
        throw new Error('Distributor not found');
      }

      return distributor;
    } catch (error) {
      logger.error({ error, companyId, distributorId }, 'Error getting distributor');
      throw error;
    }
  }

  /**
   * List distributors with pagination and filters
   */
  async listDistributors(
    companyId: string,
    options: {
      page?: number;
      limit?: number;
      search?: string;
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

      if (options.search) {
        where.OR = [
          { arabicName: { contains: options.search } },
          { englishName: { contains: options.search } },
          { serial: { contains: options.search } },
          { barcode: { contains: options.search } },
        ];
      }

      const [distributors, total] = await Promise.all([
        prisma.distributor.findMany({
          where,
          skip,
          take: limit,
          orderBy: { createdAt: 'desc' },
        }),
        prisma.distributor.count({ where }),
      ]);

      return {
        distributors,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      };
    } catch (error) {
      logger.error({ error, companyId, options }, 'Error listing distributors');
      throw error;
    }
  }

  /**
   * Update distributor
   */
  async updateDistributor(
    companyId: string,
    distributorId: string,
    data: UpdateDistributorInput
  ) {
    try {
      const existing = await prisma.distributor.findFirst({
        where: {
          id: distributorId,
          companyId,

        },
      });

      if (!existing) {
        throw new Error('Distributor not found');
      }

      const distributor = await prisma.distributor.update({
        where: { id: distributorId },
        data: {
          serial: data.serial,
          arabicName: data.arabicName,
          englishName: data.englishName,
          nationality: data.nationality,
          barcode: data.barcode,
          phone1: data.phone1,
          phone2: data.phone2,
          mobile: data.mobile,
          fax: data.fax,
          email: data.email,
          website: data.website,
          country: data.country,
          city: data.city,
          area: data.area,
          street: data.street,
          postalCode: data.postalCode,
          poBox: data.poBox,
        },
      });

      logger.info({ companyId, distributorId }, 'Distributor updated');
      return distributor;
    } catch (error) {
      logger.error({ error, companyId, distributorId, data }, 'Error updating distributor');
      throw error;
    }
  }

  /**
   * Delete distributor (soft delete)
   */
  async deleteDistributor(companyId: string, distributorId: string) {
    try {
      const distributor = await prisma.distributor.findFirst({
        where: {
          id: distributorId,
          companyId,

        },
      });

      if (!distributor) {
        throw new Error('Distributor not found');
      }

      await prisma.distributor.update({
        where: { id: distributorId },
        data: { deletedAt: new Date() },
      });

      logger.info({ companyId, distributorId }, 'Distributor deleted');
      return { success: true };
    } catch (error) {
      logger.error({ error, companyId, distributorId }, 'Error deleting distributor');
      throw error;
    }
  }
}

export const distributorService = new DistributorService();

