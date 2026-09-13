import prisma from '../../../shared/database/prisma';
import { logger } from '../../../shared/logger';
import { Decimal } from '@prisma/client/runtime/library';

export interface CreateCurrencyData {
  code: string; // e.g., "EGP"
  arabicName: string;
  englishName?: string;
  exchangeRate?: number;
}

export interface UpdateCurrencyData extends Partial<CreateCurrencyData> {
  isActive?: boolean;
}

export class CurrencyService {
  /**
   * Create a new currency
   */
  async createCurrency(companyId: string, data: CreateCurrencyData) {
    try {
      const currency = await prisma.currency.create({
        data: {
          companyId,
          code: data.code,
          arabicName: data.arabicName,
          englishName: data.englishName,
          exchangeRate: data.exchangeRate
            ? new Decimal(data.exchangeRate)
            : null,
        },
      });

      logger.info({ companyId, currencyId: currency.id }, 'Currency created');
      return currency;
    } catch (error) {
      logger.error({ error, companyId, data }, 'Error creating currency');
      throw error;
    }
  }

  /**
   * Get currency by ID
   */
  async getCurrencyById(companyId: string, currencyId: string) {
    try {
      const currency = await prisma.currency.findFirst({
        where: {
          id: currencyId,
          companyId,

        },
      });

      if (!currency) {
        throw new Error('Currency not found');
      }

      return currency;
    } catch (error) {
      logger.error({ error, companyId, currencyId }, 'Error getting currency');
      throw error;
    }
  }

  /**
   * Get currency by code
   */
  async getCurrencyByCode(companyId: string, code: string) {
    try {
      const currency = await prisma.currency.findFirst({
        where: {
          companyId,
          code,
        },
      });

      if (!currency) {
        throw new Error('Currency not found');
      }

      return currency;
    } catch (error) {
      logger.error({ error, companyId, code }, 'Error getting currency by code');
      throw error;
    }
  }

  /**
   * List currencies with pagination and filters
   */
  async listCurrencies(
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

      const [currencies, total] = await Promise.all([
        prisma.currency.findMany({
          where,
          skip,
          take: limit,
          orderBy: [{ code: 'asc' }],
        }),
        prisma.currency.count({ where }),
      ]);

      return {
        currencies,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      };
    } catch (error) {
      logger.error({ error, companyId, options }, 'Error listing currencies');
      throw error;
    }
  }

  /**
   * Update currency
   */
  async updateCurrency(
    companyId: string,
    currencyId: string,
    data: UpdateCurrencyData
  ) {
    try {
      const existing = await prisma.currency.findFirst({
        where: { id: currencyId, companyId },
      });

      if (!existing) {
        throw new Error('Currency not found');
      }

      const updateData: any = {};

      if (data.code !== undefined) updateData.code = data.code;
      if (data.arabicName !== undefined) updateData.arabicName = data.arabicName;
      if (data.englishName !== undefined)
        updateData.englishName = data.englishName;
      if (data.exchangeRate !== undefined)
        updateData.exchangeRate = data.exchangeRate
          ? new Decimal(data.exchangeRate)
          : null;
      if (data.isActive !== undefined) updateData.isActive = data.isActive;

      const currency = await prisma.currency.update({
        where: { id: currencyId },
        data: updateData,
      });

      logger.info({ companyId, currencyId }, 'Currency updated');
      return currency;
    } catch (error) {
      logger.error({ error, companyId, currencyId, data }, 'Error updating currency');
      throw error;
    }
  }

  /**
   * Delete currency (soft delete)
   */
  async deleteCurrency(companyId: string, currencyId: string) {
    try {
      const currency = await prisma.currency.findFirst({
        where: { id: currencyId, companyId },
      });

      if (!currency) {
        throw new Error('Currency not found');
      }

      await prisma.currency.update({
        where: { id: currencyId },
        data: { isActive: false },
      });

      logger.info({ companyId, currencyId }, 'Currency deleted');
      return { success: true };
    } catch (error) {
      logger.error({ error, companyId, currencyId }, 'Error deleting currency');
      throw error;
    }
  }
}

export const currencyService = new CurrencyService();
