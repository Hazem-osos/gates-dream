import prisma from '../../../shared/database/prisma';
import { logger } from '../../../shared/logger';
import { tenantProvisioningService } from '../../accounting/services/tenant-provisioning.service';

export interface CreateCompanyData {
  serial?: string;
  arabicName: string;
  englishName?: string;
  entityType?: string; // e.g., "جنية مصري"
  entityTypeCode?: string;
  entityNumber?: string;
  phone1?: string;
  phone2?: string;
  address?: string;
  taxNumber1?: string;
  taxNumber2?: string;
  taxNumber3?: string;
}

export interface UpdateCompanyData extends Partial<CreateCompanyData> {
  isActive?: boolean;
}

export class CompanyService {
  /**
   * Create a new company
   */
  async createCompany(data: CreateCompanyData) {
    try {
      // Check if serial already exists
      if (data.serial) {
        const existing = await prisma.company.findUnique({
          where: { serial: data.serial },
        });

        if (existing) {
          throw new Error('Company with this serial number already exists');
        }
      }

      const company = await prisma.company.create({
        data: {
          serial: data.serial,
          arabicName: data.arabicName,
          englishName: data.englishName,
          entityType: data.entityType,
          entityTypeCode: data.entityTypeCode,
          entityNumber: data.entityNumber,
          phone1: data.phone1,
          phone2: data.phone2,
          address: data.address,
          taxNumber1: data.taxNumber1,
          taxNumber2: data.taxNumber2,
          taxNumber3: data.taxNumber3,
          isActive: true,
        },
        include: {
          branches: {
            select: {
              id: true,
              serial: true,
              arabicName: true,
            },
          },
        },
      });

      logger.info({ companyId: company.id }, 'Company created');

      try {
        await tenantProvisioningService.provisionStandardTenant(company.id, { currencyCode: 'EGP' });
      } catch (provisionErr) {
        logger.error({ provisionErr, companyId: company.id }, 'Tenant provisioning failed after company create');
      }

      return company;
    } catch (error) {
      logger.error({ error, data }, 'Error creating company');
      throw error;
    }
  }

  /**
   * Get company by ID
   */
  async getCompanyById(companyId: string) {
    try {
      const company = await prisma.company.findUnique({
        where: { id: companyId },
        include: {
          branches: {
            select: {
              id: true,
              serial: true,
              arabicName: true,
              branchNumber: true,
            },
          },
        },
      });

      if (!company) {
        throw new Error('Company not found');
      }

      return company;
    } catch (error) {
      logger.error({ error, companyId }, 'Error getting company');
      throw error;
    }
  }

  /**
   * List companies with pagination and filters.
   *
   * SECURITY: `callerCompanyId` pins the result to the caller's own tenant. Without it,
   * this returned every company in the system to any authenticated user holding the
   * ordinary `company:view` permission.
   */
  async listCompanies(options: {
    page?: number;
    limit?: number;
    search?: string;
    isActive?: boolean;
    callerCompanyId: string;
  }) {
    try {
      const page = options.page || 1;
      const limit = options.limit || 50;
      const skip = (page - 1) * limit;

      const where: any = { id: options.callerCompanyId };

      if (options.search) {
        where.OR = [
          { arabicName: { contains: options.search } },
          { englishName: { contains: options.search } },
          { serial: { contains: options.search } },
          { entityNumber: { contains: options.search } },
        ];
      }

      if (options.isActive !== undefined) {
        where.isActive = options.isActive;
      }

      const [companies, total] = await Promise.all([
        prisma.company.findMany({
          where,
          skip,
          take: limit,
          orderBy: [{ arabicName: 'asc' }],
          include: {
            _count: {
              select: {
                branches: true,
                users: true,
              },
            },
          },
        }),
        prisma.company.count({ where }),
      ]);

      return {
        companies,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      };
    } catch (error) {
      logger.error({ error, options }, 'Error listing companies');
      throw error;
    }
  }

  /**
   * Update company
   */
  async updateCompany(companyId: string, data: UpdateCompanyData) {
    try {
      // Check if company exists
      const existing = await prisma.company.findUnique({
        where: { id: companyId },
      });

      if (!existing) {
        throw new Error('Company not found');
      }

      // Check if serial is being changed and if it conflicts
      if (data.serial && data.serial !== existing.serial) {
        const serialConflict = await prisma.company.findUnique({
          where: { serial: data.serial },
        });

        if (serialConflict) {
          throw new Error('Company with this serial number already exists');
        }
      }

      const company = await prisma.company.update({
        where: { id: companyId },
        data: {
          serial: data.serial,
          arabicName: data.arabicName,
          englishName: data.englishName,
          entityType: data.entityType,
          entityTypeCode: data.entityTypeCode,
          entityNumber: data.entityNumber,
          phone1: data.phone1,
          phone2: data.phone2,
          address: data.address,
          taxNumber1: data.taxNumber1,
          taxNumber2: data.taxNumber2,
          taxNumber3: data.taxNumber3,
          isActive: data.isActive,
        },
        include: {
          branches: {
            select: {
              id: true,
              serial: true,
              arabicName: true,
            },
          },
        },
      });

      logger.info({ companyId }, 'Company updated');
      return company;
    } catch (error) {
      logger.error({ error, companyId, data }, 'Error updating company');
      throw error;
    }
  }

  /**
   * Delete company (soft delete by setting isActive to false)
   */
  async deleteCompany(companyId: string) {
    try {
      const company = await prisma.company.findUnique({
        where: { id: companyId },
      });

      if (!company) {
        throw new Error('Company not found');
      }

      // Soft delete by setting isActive to false
      const deleted = await prisma.company.update({
        where: { id: companyId },
        data: { isActive: false },
      });

      logger.info({ companyId }, 'Company deleted (soft delete)');
      return deleted;
    } catch (error) {
      logger.error({ error, companyId }, 'Error deleting company');
      throw error;
    }
  }

  /**
   * Restore company (set isActive to true)
   */
  async restoreCompany(companyId: string) {
    try {
      const company = await prisma.company.findUnique({
        where: { id: companyId },
      });

      if (!company) {
        throw new Error('Company not found');
      }

      const restored = await prisma.company.update({
        where: { id: companyId },
        data: { isActive: true },
      });

      logger.info({ companyId }, 'Company restored');
      return restored;
    } catch (error) {
      logger.error({ error, companyId }, 'Error restoring company');
      throw error;
    }
  }
}

export const companyService = new CompanyService();

