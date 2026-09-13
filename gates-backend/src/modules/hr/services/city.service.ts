import prisma from '../../../shared/database/prisma';
import { logger } from '../../../shared/logger';

export interface CreateCityData {
  code?: string;
  arabicName: string;
  englishName?: string;
}

export interface UpdateCityData extends Partial<CreateCityData> {
  isActive?: boolean;
}

export class CityService {
  async createCity(companyId: string, data: CreateCityData) {
    try {
      const city = await prisma.city.create({
        data: {
          companyId,
          code: data.code,
          arabicName: data.arabicName,
          englishName: data.englishName,
        },
      });

      logger.info({ companyId, cityId: city.id }, 'City created');
      return city;
    } catch (error) {
      logger.error({ error, companyId, data }, 'Error creating city');
      throw error;
    }
  }

  async getCityById(companyId: string, cityId: string) {
    try {
      const city = await prisma.city.findFirst({
        where: {
          id: cityId,
          companyId,

        },
      });

      if (!city) {
        throw new Error('City not found');
      }

      return city;
    } catch (error) {
      logger.error({ error, companyId, cityId }, 'Error getting city');
      throw error;
    }
  }

  async listCities(
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

      if (options.search) {
        where.OR = [
          { arabicName: { contains: options.search } },
          { englishName: { contains: options.search } },
          { code: { contains: options.search } },
        ];
      }

      if (options.isActive !== undefined) {
        where.isActive = options.isActive;
      }

      const [cities, total] = await Promise.all([
        prisma.city.findMany({
          where,
          skip,
          take: limit,
          orderBy: [{ arabicName: 'asc' }],
        }),
        prisma.city.count({ where }),
      ]);

      return {
        cities,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      };
    } catch (error) {
      logger.error({ error, companyId, options }, 'Error listing cities');
      throw error;
    }
  }

  async updateCity(companyId: string, cityId: string, data: UpdateCityData) {
    try {
      const existing = await prisma.city.findFirst({
        where: { id: cityId, companyId },
      });

      if (!existing) {
        throw new Error('City not found');
      }

      const city = await prisma.city.update({
        where: { id: cityId },
        data: {
          ...(data.code !== undefined && { code: data.code }),
          ...(data.arabicName && { arabicName: data.arabicName }),
          ...(data.englishName !== undefined && { englishName: data.englishName }),
          ...(data.isActive !== undefined && { isActive: data.isActive }),
        },
      });

      logger.info({ companyId, cityId }, 'City updated');
      return city;
    } catch (error) {
      logger.error({ error, companyId, cityId, data }, 'Error updating city');
      throw error;
    }
  }

  async deleteCity(companyId: string, cityId: string) {
    try {
      const city = await prisma.city.findFirst({
        where: { id: cityId, companyId },
      });

      if (!city) {
        throw new Error('City not found');
      }

      await prisma.city.update({
        where: { id: cityId },
        data: { isActive: false },
      });

      logger.info({ companyId, cityId }, 'City deleted');
      return { success: true };
    } catch (error) {
      logger.error({ error, companyId, cityId }, 'Error deleting city');
      throw error;
    }
  }
}

export const cityService = new CityService();
