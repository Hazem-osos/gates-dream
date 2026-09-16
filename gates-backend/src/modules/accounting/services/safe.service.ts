import prisma from '../../../shared/database/prisma';
import { logger } from '../../../shared/logger';
import { SYSTEM_GL_CODES } from '../data/system-account-map';
import {
  createCashGlForNewSafe,
  ensureSafesFromChart,
  grantSafeToExistingRightHolders,
  nextSafeCode,
} from './cash-safe-sync';

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
    options?: { isActive?: boolean; allowedSafeIds?: string[] | null; skipChartSync?: boolean }
  ) {
    if (!options?.skipChartSync) {
      await ensureSafesFromChart(companyId);
    }
    const where: any = { companyId };
    if (options?.isActive !== undefined) {
      where.isActive = options.isActive;
    }
    if (options?.allowedSafeIds) {
      where.id = { in: options.allowedSafeIds };
    }

    const [rows, defaultBranch] = await Promise.all([
      prisma.safe.findMany({
        where,
        orderBy: { arabicName: 'asc' },
        include: {
          glAccount: {
            select: { id: true, code: true, arabicName: true, englishName: true },
          },
        },
      }),
      prisma.branch.findFirst({
        where: { companyId, deletedAt: null, defaultSafeId: { not: null } },
        orderBy: { createdAt: 'asc' },
        select: { defaultSafeId: true },
      }),
    ]);
    const branchDefaultId =
      defaultBranch?.defaultSafeId && rows.some((row) => row.id === defaultBranch.defaultSafeId)
        ? defaultBranch.defaultSafeId
        : null;
    const cashMainSafeId =
      rows.find((row) => row.glAccount?.code === SYSTEM_GL_CODES.cashMain)?.id ?? null;
    const defaultSafeId = branchDefaultId ?? cashMainSafeId;
    return rows
      .map((row) => ({
        ...row,
        isDefault: Boolean(defaultSafeId && row.id === defaultSafeId),
      }))
      .sort((a, b) => Number(b.isDefault) - Number(a.isDefault) || a.arabicName.localeCompare(b.arabicName, 'ar'));
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

    const glAccountId = await createCashGlForNewSafe(companyId, data.arabicName);

    const created = await prisma.safe.create({
      data: {
        companyId,
        code: data.code?.trim() || (await nextSafeCode(companyId)),
        arabicName: data.arabicName,
        englishName: data.englishName,
        currencyCode: data.currencyCode,
        glAccountId,
        balance: 0,
        isActive: true,
      },
      include: {
        glAccount: {
          select: { id: true, code: true, arabicName: true, englishName: true },
        },
      },
    });
    await grantSafeToExistingRightHolders(companyId, created.id);
    return created;
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

