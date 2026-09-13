import prisma from '../../../shared/database/prisma';
import { logger } from '../../../shared/logger';
import { getTenantCached, invalidateTenantCache, tenantCacheKeys } from '../../../shared/cache/tenant-metadata-cache';

export interface CreateBranchData {
  companyId: string;
  serial?: string;
  arabicName: string;
  branchNumber?: string;
  activationNumber?: string;
  priceList?: string;
  registrationNumber?: string;
  barcodePrice?: string; // e.g., "بالجملة"
  governorate?: string;
  district?: string;
  streetName?: string;
  country?: string;
  city?: string;
  buildingNumber?: string;
  postalCode?: string;
  address?: string;
  defaultWarehouseId?: string;
  defaultSafeId?: string;
}

export interface UpdateBranchData extends Partial<Omit<CreateBranchData, 'defaultWarehouseId' | 'defaultSafeId'>> {
  defaultWarehouseId?: string | null;
  defaultSafeId?: string | null;
}

export class BranchService {
  /**
   * Create a new branch
   */
  async createBranch(data: CreateBranchData) {
    try {
      // Verify company exists
      const company = await prisma.company.findUnique({
        where: { id: data.companyId },
      });

      if (!company) {
        throw new Error('Company not found');
      }

      // Check if serial already exists
      if (data.serial) {
        const existing = await prisma.branch.findUnique({
          where: { serial: data.serial },
        });

        if (existing) {
          throw new Error('Branch with this serial number already exists');
        }
      }

      const branch = await prisma.branch.create({
        data: {
          companyId: data.companyId,
          serial: data.serial,
          arabicName: data.arabicName,
          branchNumber: data.branchNumber,
          activationNumber: data.activationNumber,
          priceList: data.priceList,
          registrationNumber: data.registrationNumber,
          barcodePrice: data.barcodePrice,
          governorate: data.governorate,
          district: data.district,
          streetName: data.streetName,
          country: data.country,
          city: data.city,
          buildingNumber: data.buildingNumber,
          postalCode: data.postalCode,
          address: data.address,
        },
        include: {
          company: {
            select: {
              id: true,
              arabicName: true,
            },
          },
        },
      });

      logger.info({ companyId: data.companyId, branchId: branch.id }, 'Branch created');
      await invalidateTenantCache(tenantCacheKeys.branches(data.companyId));
      return branch;
    } catch (error) {
      logger.error({ error, data }, 'Error creating branch');
      throw error;
    }
  }

  /**
   * Get branch by ID
   */
  async getBranchById(companyId: string, branchId: string) {
    try {
      const branch = await prisma.branch.findFirst({
        where: {
          id: branchId,
          companyId,
        },
        include: {
          company: {
            select: {
              id: true,
              arabicName: true,
            },
          },
        },
      });

      if (!branch) {
        throw new Error('Branch not found');
      }

      return branch;
    } catch (error) {
      logger.error({ error, companyId, branchId }, 'Error getting branch');
      throw error;
    }
  }

  /**
   * List branches with pagination and filters
   */
  async listBranches(
    companyId: string,
    options: {
      page?: number;
      limit?: number;
      search?: string;
    }
  ) {
    const page = options.page || 1;
    const limit = options.limit || 50;
    if (!options.search && page === 1 && limit <= 50) {
      return getTenantCached(
        `${tenantCacheKeys.branches(companyId)}:p${page}:l${limit}`,
        () => this.listBranchesUncached(companyId, options),
        180
      );
    }
    return this.listBranchesUncached(companyId, options);
  }

  private async listBranchesUncached(
    companyId: string,
    options: {
      page?: number;
      limit?: number;
      search?: string;
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
          { serial: { contains: options.search } },
          { branchNumber: { contains: options.search } },
        ];
      }

      const [branches, total] = await Promise.all([
        prisma.branch.findMany({
          where,
          skip,
          take: limit,
          orderBy: [{ arabicName: 'asc' }],
          include: {
            defaultWarehouse: { select: { id: true, arabicName: true, code: true } },
            defaultSafe: { select: { id: true, arabicName: true, code: true } },
            _count: {
              select: {
                warehouses: true,
              },
            },
          },
        }),
        prisma.branch.count({ where }),
      ]);

      return {
        branches,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      };
    } catch (error) {
      logger.error({ error, companyId, options }, 'Error listing branches');
      throw error;
    }
  }

  /**
   * Update branch
   */
  async updateBranch(companyId: string, branchId: string, data: UpdateBranchData) {
    try {
      // Verify branch exists and belongs to company
      const existing = await prisma.branch.findFirst({
        where: { id: branchId, companyId },
      });

      if (!existing) {
        throw new Error('Branch not found');
      }

      // Check if serial is being changed and if it conflicts
      if (data.serial && data.serial !== existing.serial) {
        const serialConflict = await prisma.branch.findUnique({
          where: { serial: data.serial },
        });

        if (serialConflict) {
          throw new Error('Branch with this serial number already exists');
        }
      }

      const branch = await prisma.branch.update({
        where: { id: branchId },
        data: {
          serial: data.serial,
          arabicName: data.arabicName,
          branchNumber: data.branchNumber,
          activationNumber: data.activationNumber,
          priceList: data.priceList,
          registrationNumber: data.registrationNumber,
          barcodePrice: data.barcodePrice,
          governorate: data.governorate,
          district: data.district,
          streetName: data.streetName,
          country: data.country,
          city: data.city,
          buildingNumber: data.buildingNumber,
          postalCode: data.postalCode,
          address: data.address,
          defaultWarehouseId: data.defaultWarehouseId,
          defaultSafeId: data.defaultSafeId,
        },
        include: {
          company: {
            select: {
              id: true,
              arabicName: true,
            },
          },
          defaultWarehouse: { select: { id: true, arabicName: true, code: true } },
          defaultSafe: { select: { id: true, arabicName: true, code: true } },
        },
      });

      logger.info({ companyId, branchId }, 'Branch updated');
      return branch;
    } catch (error) {
      logger.error({ error, companyId, branchId, data }, 'Error updating branch');
      throw error;
    }
  }

  /**
   * Delete branch
   */
  async deleteBranch(companyId: string, branchId: string) {
    try {
      const branch = await prisma.branch.findFirst({
        where: { id: branchId, companyId },
      });

      if (!branch) {
        throw new Error('Branch not found');
      }

      // Check if branch has warehouses
      const warehouseCount = await prisma.warehouse.count({
        where: { branchId },
      });

      if (warehouseCount > 0) {
        throw new Error(
          `Cannot delete branch: ${warehouseCount} warehouse(s) are associated with this branch`
        );
      }

      await prisma.branch.delete({
        where: { id: branchId },
      });

      logger.info({ companyId, branchId }, 'Branch deleted');
      return { success: true };
    } catch (error) {
      logger.error({ error, companyId, branchId }, 'Error deleting branch');
      throw error;
    }
  }
}

export const branchService = new BranchService();

