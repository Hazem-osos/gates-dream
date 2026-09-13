import prisma from '../../../shared/database/prisma';
import { logger } from '../../../shared/logger';

export interface CreateLocationData {
  warehouseId: string;
  code?: string;
  arabicName: string;
  englishName?: string;
}

export interface UpdateLocationData extends Partial<CreateLocationData> {}

export class LocationService {
  /**
   * Create a new location
   */
  async createLocation(companyId: string, data: CreateLocationData) {
    try {
      // Verify warehouse belongs to company
      const warehouse = await prisma.warehouse.findFirst({
        where: { id: data.warehouseId, companyId },
      });

      if (!warehouse) {
        throw new Error('Warehouse not found');
      }

      const location = await prisma.location.create({
        data: {
          warehouseId: data.warehouseId,
          code: data.code,
          arabicName: data.arabicName,
          englishName: data.englishName,
        },
        include: {
          warehouse: {
            select: {
              id: true,
              code: true,
              arabicName: true,
            },
          },
        },
      });

      logger.info({ companyId, locationId: location.id }, 'Location created');
      return location;
    } catch (error) {
      logger.error({ error, companyId, data }, 'Error creating location');
      throw error;
    }
  }

  /**
   * Get location by ID
   */
  async getLocationById(companyId: string, locationId: string) {
    try {
      const location = await prisma.location.findFirst({
        where: {
          id: locationId,
          warehouse: {
            companyId,
          },
        },
        include: {
          warehouse: {
            select: {
              id: true,
              code: true,
              arabicName: true,
              englishName: true,
            },
          },
        },
      });

      if (!location) {
        throw new Error('Location not found');
      }

      return location;
    } catch (error) {
      logger.error({ error, companyId, locationId }, 'Error getting location');
      throw error;
    }
  }

  /**
   * List locations with pagination and filters
   */
  async listLocations(
    companyId: string,
    options: {
      page?: number;
      limit?: number;
      search?: string;
      warehouseId?: string;
    }
  ) {
    try {
      const page = options.page || 1;
      const limit = options.limit || 50;
      const skip = (page - 1) * limit;

      const where: any = {
        warehouse: {
          companyId,
        },
      };

      if (options.search) {
        where.OR = [
          { arabicName: { contains: options.search } },
          { englishName: { contains: options.search } },
          { code: { contains: options.search } },
        ];
      }

      if (options.warehouseId) {
        where.warehouseId = options.warehouseId;
      }

      const [locations, total] = await Promise.all([
        prisma.location.findMany({
          where,
          skip,
          take: limit,
          orderBy: [{ arabicName: 'asc' }],
          include: {
            warehouse: {
              select: {
                id: true,
                code: true,
                arabicName: true,
              },
            },
          },
        }),
        prisma.location.count({ where }),
      ]);

      return {
        locations,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      };
    } catch (error) {
      logger.error({ error, companyId, options }, 'Error listing locations');
      throw error;
    }
  }

  /**
   * Update location
   */
  async updateLocation(
    companyId: string,
    locationId: string,
    data: UpdateLocationData
  ) {
    try {
      const existing = await prisma.location.findFirst({
        where: {
          id: locationId,
          warehouse: {
            companyId,
          },
        },
      });

      if (!existing) {
        throw new Error('Location not found');
      }

      // If warehouseId is being updated, verify it belongs to company
      if (data.warehouseId && data.warehouseId !== existing.warehouseId) {
        const warehouse = await prisma.warehouse.findFirst({
          where: { id: data.warehouseId, companyId },
        });

        if (!warehouse) {
          throw new Error('Warehouse not found');
        }
      }

      const location = await prisma.location.update({
        where: { id: locationId },
        data: {
          ...(data.code !== undefined && { code: data.code }),
          ...(data.arabicName && { arabicName: data.arabicName }),
          ...(data.englishName !== undefined && { englishName: data.englishName }),
          ...(data.warehouseId && { warehouseId: data.warehouseId }),
        },
        include: {
          warehouse: {
            select: {
              id: true,
              code: true,
              arabicName: true,
            },
          },
        },
      });

      logger.info({ companyId, locationId }, 'Location updated');
      return location;
    } catch (error) {
      logger.error({ error, companyId, locationId, data }, 'Error updating location');
      throw error;
    }
  }

  /**
   * Delete location
   */
  async deleteLocation(companyId: string, locationId: string) {
    try {
      const location = await prisma.location.findFirst({
        where: {
          id: locationId,
          warehouse: {
            companyId,
          },
        },
      });

      if (!location) {
        throw new Error('Location not found');
      }

      await prisma.location.delete({
        where: { id: locationId },
      });

      logger.info({ companyId, locationId }, 'Location deleted');
      return { success: true };
    } catch (error) {
      logger.error({ error, companyId, locationId }, 'Error deleting location');
      throw error;
    }
  }
}

export const locationService = new LocationService();
