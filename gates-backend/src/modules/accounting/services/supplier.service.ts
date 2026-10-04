import prisma from '../../../shared/database/prisma';
import { logger } from '../../../shared/logger';
import { Decimal } from '@prisma/client/runtime/library';
import { applyFullTextIds, findFullTextIds } from '../../../shared/database/fulltext-search';
import { supplierLedgerAccountService } from './party-ledger-account.service';
import { nextNumericCode } from '../../../shared/utils/next-numeric-code';
import { AppError } from '../../../shared/middleware/error-handler';
import { emitDomainEvent } from '../../automation/events/automation-event-bus.service';

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
  supplierCategoryId: true,
  priceListId: true,
  discountType: true,
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
  priceListId?: string | null;
  mainAccountId?: string;
  accountId?: string;
  transactionType?: string;
  warning?: string;
  estimatedBudget?: number;
  paymentTermsDays?: number | null;
  currencyCode?: string;
  supplierCategoryId?: string | null;
}

export interface UpdateSupplierData extends Partial<CreateSupplierData> {
  isActive?: boolean;
}

export class SupplierService {
  /**
   * Create a new supplier
   */
  async nextSupplierCode(companyId: string): Promise<string> {
    const rows = await prisma.supplier.findMany({
      where: { companyId },
      select: { serial: true, code: true },
    });
    return nextNumericCode(rows.flatMap((row) => [row.serial, row.code]));
  }

  async createSupplier(companyId: string, data: CreateSupplierData) {
    try {
      const requestedSerial = data.serial?.trim();
      const requestedCode = data.code?.trim();
      const serial =
        requestedSerial || requestedCode || (await this.nextSupplierCode(companyId));
      const code = requestedCode || requestedSerial || serial;
      const clash = await prisma.supplier.findFirst({
        where: {
          companyId,
          isActive: true,
          OR: [{ code }, { serial }],
        },
        select: { arabicName: true },
      });
      if (clash) {
        throw new AppError(
          409,
          `الكود «${code}» مستخدم على «${clash.arabicName}». غيّر الكود ثم احفظ.`
        );
      }
      await supplierLedgerAccountService.assertLedgerAvailable({
        side: 'SUPPLIER',
        companyId,
        arabicName: data.arabicName,
        requestedAccountId: data.mainAccountId ?? data.accountId,
      });
      const createdSupplier = await prisma.$transaction(async (tx) => {
      const supplier = await tx.supplier.create({
        data: {
          companyId,
          serial,
          code,
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
          priceListId: data.priceListId ?? null,
          mainAccountId: data.mainAccountId,
          accountId: data.accountId,
          transactionType: data.transactionType,
          warning: data.warning,
          estimatedBudget: data.estimatedBudget
            ? new Decimal(data.estimatedBudget)
            : null,
          paymentTermsDays: data.paymentTermsDays ?? null,
          currencyCode: data.currencyCode,
          supplierCategoryId: data.supplierCategoryId ?? null,
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

      await supplierLedgerAccountService.ensureForSupplier({
        companyId,
        supplierId: supplier.id,
        requestedAccountId: data.mainAccountId ?? data.accountId,
        db: tx,
      });

      return tx.supplier.findFirstOrThrow({
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
      });

      logger.info({ companyId, supplierId: createdSupplier.id }, 'Supplier created');
      void emitDomainEvent({
        companyId,
        eventType: 'supplier.created',
        data: {
          supplierId: createdSupplier.id,
          arabicName: createdSupplier.arabicName,
          supplierType: createdSupplier.supplierType ?? null,
        },
      });
      return createdSupplier;
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
        throw new Error('المورد غير موجود');
      }

      return supplier;
    } catch (error) {
      if (!(error instanceof Error && error.message === 'المورد غير موجود')) {
        logger.error({ error, companyId, supplierId }, 'Error getting supplier');
      }
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
      supplierCategoryId?: string;
      accountId?: string;
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

      if (options.supplierCategoryId) {
        where.supplierCategoryId = options.supplierCategoryId;
      }

      if (options.accountId) {
        where.AND = [
          ...(Array.isArray(where.AND) ? where.AND : where.AND ? [where.AND] : []),
          {
            OR: [{ accountId: options.accountId }, { mainAccountId: options.accountId }],
          },
        ];
      }

      const [suppliers, total] = await Promise.all([
        prisma.supplier.findMany({
          where,
          skip,
          take: limit,
          orderBy: [{ code: 'asc' }, { serial: 'asc' }, { arabicName: 'asc' }],
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
        throw new Error('المورد غير موجود');
      }

      await supplierLedgerAccountService.assertLedgerAvailable({
        side: 'SUPPLIER',
        companyId,
        arabicName: data.arabicName ?? existing.arabicName,
        requestedAccountId: data.mainAccountId ?? data.accountId ?? existing.mainAccountId,
        exceptPartyId: supplierId,
        exceptAccountId: existing.mainAccountId ?? existing.accountId,
      });

      const updateData: Record<string, unknown> = {};
      const textFields = [
        'serial',
        'code',
        'arabicName',
        'englishName',
        'supplierType',
        'how',
        'nationality',
        'taxAuthority',
        'taxAuthorityName',
        'phone1',
        'phone2',
        'mobile',
        'fax',
        'email',
        'website',
        'country',
        'city',
        'area',
        'street',
        'postalCode',
        'poBox',
        'fileNumber',
        'registrationNumber',
        'financier',
        'discountType',
        'mainAccountId',
        'accountId',
        'transactionType',
        'warning',
        'currencyCode',
        'supplierCategoryId',
      ] as const;
      for (const key of textFields) {
        if (data[key] !== undefined) updateData[key] = data[key];
      }
      if (data.taxData !== undefined) updateData.taxData = data.taxData;
      if (data.paymentTermsDays !== undefined) updateData.paymentTermsDays = data.paymentTermsDays;
      if (data.estimatedBudget !== undefined) {
        updateData.estimatedBudget =
          data.estimatedBudget == null ? null : new Decimal(data.estimatedBudget);
      }
      if (data.isActive !== undefined) updateData.isActive = data.isActive;
      if (data.priceListId !== undefined) updateData.priceListId = data.priceListId;

      const updated = await prisma.supplier.updateMany({
        where: { id: supplierId, companyId },
        data: updateData,
      });
      if (updated.count !== 1) {
        throw new AppError(404, 'المورد غير موجود');
      }

      await supplierLedgerAccountService.ensureForSupplier({
        companyId,
        supplierId,
        requestedAccountId: data.mainAccountId ?? data.accountId ?? existing.mainAccountId,
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
      return withLedger;
    } catch (error) {
      logger.error({ error, companyId, supplierId, data }, 'Error updating supplier');
      throw error;
    }
  }

  /**
   * Delete supplier. Blocked if the party or its personal GL account has movements.
   * Unused personal accounts are removed from the chart of accounts.
   */
  async deleteSupplier(companyId: string, supplierId: string) {
    try {
      await supplierLedgerAccountService.retirePartyAndLedger({
        side: 'SUPPLIER',
        companyId,
        partyId: supplierId,
      });

      logger.info({ companyId, supplierId }, 'Supplier deleted');
      return { success: true };
    } catch (error) {
      if (!(error instanceof AppError)) {
        logger.error({ error, companyId, supplierId }, 'Error deleting supplier');
      }
      throw error;
    }
  }
}

export const supplierService = new SupplierService();
