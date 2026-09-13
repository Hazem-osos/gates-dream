import prisma from '../../../shared/database/prisma';
import { logger } from '../../../shared/logger';

export interface CreateSafeData {
  code?: string;
  arabicName: string;
  englishName?: string;
  currencyCode: string;
}

export interface UpdateSafeData {
  code?: string;
  arabicName?: string;
  englishName?: string;
  currencyCode?: string;
  isActive?: boolean;
}

export class SafeService {
  /**
   * Get all safes for a company
   */
  async getSafes(
    companyId: string,
    options?: { isActive?: boolean; allowedSafeIds?: string[] | null }
  ) {
    const where: any = { companyId };
    if (options?.isActive !== undefined) {
      where.isActive = options.isActive;
    }
    if (options?.allowedSafeIds) {
      where.id = { in: options.allowedSafeIds };
    }

    return prisma.safe.findMany({
      where,
      orderBy: { arabicName: 'asc' },
      include: {
        glAccount: {
          select: { id: true, code: true, arabicName: true, englishName: true },
        },
      },
    });
  }

  /**
   * Get a single safe by ID
   */
  async getSafeById(companyId: string, safeId: string) {
    const safe = await prisma.safe.findFirst({
      where: {
        id: safeId,
        companyId,
      },
    });

    if (!safe) {
      throw new Error('Safe not found');
    }

    return safe;
  }

  /**
   * Create a new safe
   */
  async createSafe(companyId: string, data: CreateSafeData) {
    // Check if code already exists
    if (data.code) {
      const existing = await prisma.safe.findFirst({
        where: {
          companyId,
          code: data.code,
        },
      });

      if (existing) {
        throw new Error('Safe code already exists');
      }
    }

    return prisma.safe.create({
      data: {
        companyId,
        code: data.code,
        arabicName: data.arabicName,
        englishName: data.englishName,
        currencyCode: data.currencyCode,
        balance: 0,
        isActive: true,
      },
    });
  }

  /**
   * Update a safe
   */
  async updateSafe(companyId: string, safeId: string, data: UpdateSafeData) {
    const safe = await this.getSafeById(companyId, safeId);

    // Check if code already exists (if changing)
    if (data.code && data.code !== safe.code) {
      const existing = await prisma.safe.findFirst({
        where: {
          companyId,
          code: data.code,
          id: { not: safeId },
        },
      });

      if (existing) {
        throw new Error('Safe code already exists');
      }
    }

    return prisma.safe.update({
      where: { id: safeId },
      data,
    });
  }

  /**
   * Delete a safe (soft delete by setting isActive to false)
   */
  async deleteSafe(companyId: string, safeId: string) {
    await this.getSafeById(companyId, safeId);

    return prisma.safe.update({
      where: { id: safeId },
      data: { isActive: false },
    });
  }
}

export const safeService = new SafeService();

