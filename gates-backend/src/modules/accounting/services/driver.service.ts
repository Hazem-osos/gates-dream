import prisma from '../../../shared/database/prisma';
import { logger } from '../../../shared/logger';
import { CreateDriverInput, UpdateDriverInput } from '../schemas/driver.schema';

export class DriverService {
  /**
   * Create a new driver
   */
  async createDriver(companyId: string, data: CreateDriverInput) {
    try {
      const driver = await prisma.driver.create({
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

      logger.info({ companyId, driverId: driver.id }, 'Driver created');
      return driver;
    } catch (error) {
      logger.error({ error, companyId, data }, 'Error creating driver');
      throw error;
    }
  }

  /**
   * Get driver by ID
   */
  async getDriverById(companyId: string, driverId: string) {
    try {
      const driver = await prisma.driver.findFirst({
        where: {
          id: driverId,
          companyId,

        },
      });

      if (!driver) {
        throw new Error('Driver not found');
      }

      return driver;
    } catch (error) {
      logger.error({ error, companyId, driverId }, 'Error getting driver');
      throw error;
    }
  }

  /**
   * List drivers with pagination and filters
   */
  async listDrivers(
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

      const [drivers, total] = await Promise.all([
        prisma.driver.findMany({
          where,
          skip,
          take: limit,
          orderBy: { createdAt: 'desc' },
        }),
        prisma.driver.count({ where }),
      ]);

      return {
        drivers,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      };
    } catch (error) {
      logger.error({ error, companyId, options }, 'Error listing drivers');
      throw error;
    }
  }

  /**
   * Update driver
   */
  async updateDriver(
    companyId: string,
    driverId: string,
    data: UpdateDriverInput
  ) {
    try {
      const existing = await prisma.driver.findFirst({
        where: {
          id: driverId,
          companyId,

        },
      });

      if (!existing) {
        throw new Error('Driver not found');
      }

      const driver = await prisma.driver.update({
        where: { id: driverId },
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

      logger.info({ companyId, driverId }, 'Driver updated');
      return driver;
    } catch (error) {
      logger.error({ error, companyId, driverId, data }, 'Error updating driver');
      throw error;
    }
  }

  /**
   * Delete driver (soft delete)
   */
  async deleteDriver(companyId: string, driverId: string) {
    try {
      const driver = await prisma.driver.findFirst({
        where: {
          id: driverId,
          companyId,

        },
      });

      if (!driver) {
        throw new Error('Driver not found');
      }

      await prisma.driver.update({
        where: { id: driverId },
        data: { deletedAt: new Date() },
      });

      logger.info({ companyId, driverId }, 'Driver deleted');
      return { success: true };
    } catch (error) {
      logger.error({ error, companyId, driverId }, 'Error deleting driver');
      throw error;
    }
  }
}

export const driverService = new DriverService();

