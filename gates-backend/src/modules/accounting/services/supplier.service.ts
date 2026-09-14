import prisma from '../../../shared/database/prisma';
import { logger } from '../../../shared/logger';
import { Decimal } from '@prisma/client/runtime/library';
import { applyFullTextIds, findFullTextIds } from '../../../shared/database/fulltext-search';
import { supplierLedgerAccountService } from './party-ledger-account.service';

const SUPPLIER_LIST_SELECT = {
  id: true,
  companyId: true,
  serial: true,
  code: true,
  arabicName: true,
  englishName: true,
  supplierType: true,
  isActive: true,
  balance: true,
  mobile: true,
  phone1: true,
  email: true,
  taxAuthority: true,
  taxAuthorityName: true,
  creditLimit: true,
  currencyCode: true,
  createdAt: true,
  updatedAt: true,
} as const;

export interface CreateSupplierData {
  serial?: string;
  code?: string;
  arabicName: string;
  englishName?: string;
  supplierType?: string;
  how?: string;
  nationality?: string;
  taxData?: boolean;
  taxAuthority?: string;
  taxAuthorityName?: string;
  phone1?: string;
  phone2?: string;
  mobile?: string;
  fax?: string;
  email?: string;
  website?: string;
  country?: string;
  city?: string;
  area?: string;
  street?: string;
  postalCode?: string;
  poBox?: string;
  fileNumber?: string;
  registrationNumber?: string;
  financier?: string;
  discountType?: string;
  mainAccountId?: string;
  accountId?: string;
  transactionType?: string;
  warning?: string;
  estimatedBudget?: number;
  paymentTermsDays?: number | null;
  currencyCode?: string;
}

export interface UpdateSupplierData extends Partial<CreateSupplierData> {
  isActive?: boolean;
  balance?: number;
}

export class SupplierService {
  /**
   * Create a new supplier
   */
  async createSupplier(companyId: string, data: CreateSupplierData) {
    try {
      const supplier = await prisma.supplier.create({
        data: {
          companyId,
          serial: data.serial,
          code: data.code,
          arabicName: data.arabicName,
          englishName: data.englishName,
          supplierType: data.supplierType,
          how: data.how,
          nationality: data.nationality,
          taxData: data.taxData || false,
          taxAuthority: data.taxAuthority,
          taxAuthorityName: data.taxAuthorityName,
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
          fileNumber: data.fileNumber,
          registrationNumber: data.registrationNumber,
          financier: data.financier,
          discountType: data.discountType,
          mainAccountId: data.mainAccountId,
          accountId: data.accountId,
          transactionType: data.transactionType,
          warning: data.warning,
          estimatedBudget: data.estimatedBudget
            ? new Decimal(data.estimatedBudget)
            : null,
          paymentTermsDays: data.paymentTermsDays ?? null,
          currencyCode: data.currencyCode,
        },
        include: {
          mainAccount: {
            select: {
              id: true,
              code: true,
              arabicName: true,
            },
          },
        },
      });

      try {
        await supplierLedgerAccountService.ensureForSupplier({
          companyId,
          supplierId: supplier.id,
          requestedAccountId: data.mainAccountId ?? data.accountId,
        });
      } catch (ensureError) {
        await prisma.supplier.delete({ where: { id: supplier.id } }).catch(() => undefined);
        throw ensureError;
      }

      const withLedger = await prisma.supplier.findFirst({
        where: { id: supplier.id, companyId },
        include: {
          mainAccount: {
            select: {
              id: true,
              code: true,
              arabicName: true,
            },
          },
        },
      });

      logger.info({ companyId, supplierId: supplier.id }, 'Supplier created');
      return withLedger ?? supplier;
    } catch (error) {
      logger.error({ error, companyId, data }, 'Error creating supplier');
      throw error;
    }
  }

  /**
   * Get supplier by ID
   */
  async getSupplierById(companyId: string, supplierId: string) {
    try {
      const supplier = await prisma.supplier.findFirst({
        where: {
          id: supplierId,
          companyId,

        },
        include: {
          mainAccount: {
            select: {
              id: true,
              code: true,
              arabicName: true,
            },
          },
        },
      });

      if (!supplier) {
        throw new Error('Supplier not found');
      }

      return supplier;
    } catch (error) {
      logger.error({ error, companyId, supplierId }, 'Error getting supplier');
      throw error;
    }
  }

  /**
   * List suppliers with pagination and filters
   */
  async listSuppliers(
    companyId: string,
    options: {
      page?: number;
      limit?: number;
      search?: string;
      supplierType?: string;
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
        const prefix = options.search.trim();
        const ftIds = await findFullTextIds('suppliers', companyId, options.search);
        const scoped = applyFullTextIds(where, ftIds);
        if (scoped === 'empty') {
          where.OR = [{ code: { startsWith: prefix } }, { serial: { startsWith: prefix } }];
        } else if (ftIds?.length) {
          where.OR = [
            { id: { in: ftIds } },
            { code: { startsWith: prefix } },
            { serial: { startsWith: prefix } },
          ];
          delete where.id;
        }
      }

      if (options.supplierType) {
        where.supplierType = options.supplierType;
      }

      if (options.isActive !== undefined) {
        where.isActive = options.isActive;
      }

      const [suppliers, total] = await Promise.all([
        prisma.supplier.findMany({
          where,
          skip,
          take: limit,
          orderBy: [{ arabicName: 'asc' }],
          select: SUPPLIER_LIST_SELECT,
        }),
        prisma.supplier.count({ where }),
      ]);

      return {
        suppliers,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      };
    } catch (error) {
      logger.error({ error, companyId, options }, 'Error listing suppliers');
      throw error;
    }
  }

  /**
   * Update supplier
   */
  async updateSupplier(
    companyId: string,
    supplierId: string,
    data: UpdateSupplierData
  ) {
    try {
      const existing = await prisma.supplier.findFirst({
        where: { id: supplierId, companyId },
      });

      if (!existing) {
        throw new Error('Supplier not found');
      }

      const updateData: any = {};

      if (data.code !== undefined) updateData.code = data.code;
      if (data.arabicName !== undefined) updateData.arabicName = data.arabicName;
      if (data.englishName !== undefined)
        updateData.englishName = data.englishName;
      if (data.supplierType !== undefined)
        updateData.supplierType = data.supplierType;
      if (data.balance !== undefined)
        updateData.balance = new Decimal(data.balance);
      if (data.isActive !== undefined) updateData.isActive = data.isActive;
      if (data.paymentTermsDays !== undefined)
        updateData.paymentTermsDays = data.paymentTermsDays;
      // Add other fields as needed

      const supplier = await prisma.supplier.update({
        where: { id: supplierId },
        data: updateData,
        include: {
          mainAccount: {
            select: {
              id: true,
              code: true,
              arabicName: true,
            },
          },
        },
      });

      await supplierLedgerAccountService.ensureForSupplier({
        companyId,
        supplierId,
        requestedAccountId: data.mainAccountId ?? data.accountId ?? supplier.mainAccountId,
      });

      const withLedger = await prisma.supplier.findFirst({
        where: { id: supplierId, companyId },
        include: {
          mainAccount: {
            select: { id: true, code: true, arabicName: true },
          },
        },
      });

      logger.info({ companyId, supplierId }, 'Supplier updated');
      return withLedger ?? supplier;
    } catch (error) {
      logger.error({ error, companyId, supplierId, data }, 'Error updating supplier');
      throw error;
    }
  }

  /**
   * Delete supplier (soft delete)
   */
  async deleteSupplier(companyId: string, supplierId: string) {
    try {
      const supplier = await prisma.supplier.findFirst({
        where: { id: supplierId, companyId },
      });

      if (!supplier) {
        throw new Error('Supplier not found');
      }

      await prisma.supplier.update({
        where: { id: supplierId },
        data: { isActive: false },
      });

      logger.info({ companyId, supplierId }, 'Supplier deleted');
      return { success: true };
    } catch (error) {
      logger.error({ error, companyId, supplierId }, 'Error deleting supplier');
      throw error;
    }
  }
}

export const supplierService = new SupplierService();
