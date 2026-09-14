import prisma from '../../../shared/database/prisma';
import { logger } from '../../../shared/logger';
import { Decimal } from '@prisma/client/runtime/library';
import { processBatch, BatchResult } from '../../../shared/utils/batch-processor';
import { syncCustomerSupplierLink } from '../utils/party-link.util';
import type { PriceTier } from '@prisma/client';
import { applyFullTextIds, findFullTextIds } from '../../../shared/database/fulltext-search';
import { customerLedgerAccountService } from './customer-ledger-account.service';

/** Lean projection for dropdowns / list screens (avoids joining mainAccount). */
const CUSTOMER_LIST_SELECT = {
  id: true,
  companyId: true,
  serial: true,
  code: true,
  arabicName: true,
  englishName: true,
  customerType: true,
  isActive: true,
  balance: true,
  mobile: true,
  phone1: true,
  phone2: true,
  email: true,
  city: true,
  country: true,
  taxAuthority: true,
  taxAuthorityName: true,
  creditLimit: true,
  currencyCode: true,
  priceTier: true,
  linkedSupplierId: true,
  createdAt: true,
  updatedAt: true,
} as const;

export interface CreateCustomerData {
  serial?: string;
  code?: string;
  arabicName: string;
  englishName?: string;
  customerType?: string;
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
  mainAccountId?: string;
  accountId?: string;
  representativeId?: string;
  priceListId?: string;
  priceTier?: 'RETAIL' | 'SEMI_WHOLESALE' | 'WHOLESALE' | 'PROJECTS';
  linkedSupplierId?: string | null;
  sellingPrice?: string;
  transactionType?: string;
  warning?: string;
  estimatedBudget?: number;
  creditLimit?: number;
  paymentTermsDays?: number | null;
  customerCategoryId?: string;
  currencyCode?: string;
}

export interface UpdateCustomerData extends Partial<CreateCustomerData> {
  isActive?: boolean;
  balance?: number;
}

export class CustomerService {
  /**
   * Create a new customer
   */
  async createCustomer(companyId: string, data: CreateCustomerData) {
    try {
      if (data.mainAccountId) {
        const account = await prisma.account.findFirst({
          where: { id: data.mainAccountId, companyId, deletedAt: null },
        });
        if (!account) {
          throw new Error('Invalid mainAccountId for company');
        }
      }

      const customer = await prisma.customer.create({
        data: {
          companyId,
          serial: data.serial,
          code: data.code,
          arabicName: data.arabicName,
          englishName: data.englishName,
          customerType: data.customerType,
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
          mainAccountId: data.mainAccountId,
          accountId: data.accountId,
          representativeId: data.representativeId,
          priceListId: data.priceListId,
          priceTier: (data.priceTier as PriceTier | undefined) ?? 'RETAIL',
          linkedSupplierId: data.linkedSupplierId ?? null,
          sellingPrice: data.sellingPrice,
          transactionType: data.transactionType,
          warning: data.warning,
          estimatedBudget: data.estimatedBudget
            ? new Decimal(data.estimatedBudget)
            : null,
          creditLimit:
            data.creditLimit != null ? new Decimal(data.creditLimit) : null,
          paymentTermsDays: data.paymentTermsDays ?? null,
          customerCategoryId: data.customerCategoryId ?? null,
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

      if (data.linkedSupplierId) {
        await syncCustomerSupplierLink(prisma, companyId, customer.id, data.linkedSupplierId);
      }

      try {
        await customerLedgerAccountService.ensureForCustomer({
          companyId,
          customerId: customer.id,
          requestedAccountId: data.mainAccountId ?? data.accountId,
        });
      } catch (ensureError) {
        await prisma.customer.delete({ where: { id: customer.id } }).catch(() => undefined);
        throw ensureError;
      }

      const withLedger = await prisma.customer.findFirst({
        where: { id: customer.id, companyId },
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

      logger.info({ companyId, customerId: customer.id }, 'Customer created');
      return withLedger ?? customer;
    } catch (error) {
      logger.error({ error, companyId, data }, 'Error creating customer');
      throw error;
    }
  }

  /**
   * Get customer by ID
   */
  async getCustomerById(companyId: string, customerId: string) {
    try {
      const customer = await prisma.customer.findFirst({
        where: {
          id: customerId,
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

      if (!customer) {
        throw new Error('Customer not found');
      }

      return customer;
    } catch (error) {
      logger.error({ error, companyId, customerId }, 'Error getting customer');
      throw error;
    }
  }

  /**
   * List customers with pagination and filters
   */
  async listCustomers(
    companyId: string,
    options: {
      page?: number;
      limit?: number;
      search?: string;
      customerType?: string;
      isActive?: boolean;
      accountId?: string;
      customerCategoryId?: string;
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
        const ftIds = await findFullTextIds('customers', companyId, options.search);
        const scoped = applyFullTextIds(where, ftIds);
        if (scoped === 'empty') {
          // Identifier prefix still uses btree (companyId, code) — not LIKE '%…%'.
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

      if (options.customerType) {
        where.customerType = options.customerType;
      }

      if (options.isActive !== undefined) {
        where.isActive = options.isActive;
      }

      if (options.customerCategoryId) {
        where.customerCategoryId = options.customerCategoryId;
      }

      if (options.accountId) {
        where.AND = [
          ...(Array.isArray(where.AND) ? where.AND : where.AND ? [where.AND] : []),
          {
            OR: [{ accountId: options.accountId }, { mainAccountId: options.accountId }],
          },
        ];
      }

      const [customers, total] = await Promise.all([
        prisma.customer.findMany({
          where,
          skip,
          take: limit,
          orderBy: [{ arabicName: 'asc' }],
          select: CUSTOMER_LIST_SELECT,
        }),
        prisma.customer.count({ where }),
      ]);

      return {
        customers,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      };
    } catch (error) {
      logger.error({ error, companyId, options }, 'Error listing customers');
      throw error;
    }
  }

  /**
   * Update customer
   */
  async updateCustomer(
    companyId: string,
    customerId: string,
    data: UpdateCustomerData
  ) {
    try {
      const existing = await prisma.customer.findFirst({
        where: { id: customerId, companyId },
      });

      if (!existing) {
        throw new Error('Customer not found');
      }

      const updateData: Record<string, unknown> = {};

      const assign = <K extends keyof CreateCustomerData>(key: K, value: CreateCustomerData[K] | undefined) => {
        if (value !== undefined) updateData[key as string] = value;
      };

      assign('serial', data.serial);
      assign('code', data.code);
      assign('arabicName', data.arabicName);
      assign('englishName', data.englishName);
      assign('customerType', data.customerType);
      assign('how', data.how);
      assign('nationality', data.nationality);
      if (data.taxData !== undefined) updateData.taxData = data.taxData;
      assign('taxAuthority', data.taxAuthority);
      assign('taxAuthorityName', data.taxAuthorityName);
      assign('phone1', data.phone1);
      assign('phone2', data.phone2);
      assign('mobile', data.mobile);
      assign('fax', data.fax);
      assign('email', data.email);
      assign('website', data.website);
      assign('country', data.country);
      assign('city', data.city);
      assign('area', data.area);
      assign('street', data.street);
      assign('postalCode', data.postalCode);
      assign('poBox', data.poBox);
      assign('mainAccountId', data.mainAccountId);
      assign('accountId', data.accountId);
      assign('representativeId', data.representativeId);
      assign('priceListId', data.priceListId);
      if (data.priceTier !== undefined) updateData.priceTier = data.priceTier;
      if (data.linkedSupplierId !== undefined) {
        updateData.linkedSupplierId = data.linkedSupplierId;
      }
      assign('sellingPrice', data.sellingPrice);
      assign('transactionType', data.transactionType);
      assign('warning', data.warning);
      assign('customerCategoryId', data.customerCategoryId);
      assign('currencyCode', data.currencyCode);
      if (data.estimatedBudget !== undefined) {
        updateData.estimatedBudget =
          data.estimatedBudget != null ? new Decimal(data.estimatedBudget) : null;
      }
      if (data.creditLimit !== undefined) {
        updateData.creditLimit = data.creditLimit != null ? new Decimal(data.creditLimit) : null;
      }
      if (data.paymentTermsDays !== undefined) {
        updateData.paymentTermsDays = data.paymentTermsDays;
      }
      if (data.balance !== undefined) {
        updateData.balance = new Decimal(data.balance);
      }
      if (data.isActive !== undefined) updateData.isActive = data.isActive;

      const customer = await prisma.customer.update({
        where: { id: customerId, companyId },
        data: updateData as Parameters<typeof prisma.customer.update>[0]['data'],
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

      if (data.linkedSupplierId !== undefined) {
        await syncCustomerSupplierLink(prisma, companyId, customerId, data.linkedSupplierId);
      }

      await customerLedgerAccountService.ensureForCustomer({
        companyId,
        customerId,
        requestedAccountId: data.mainAccountId ?? data.accountId ?? customer.mainAccountId,
      });

      const withLedger = await prisma.customer.findFirst({
        where: { id: customerId, companyId },
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

      logger.info({ companyId, customerId }, 'Customer updated');
      return withLedger ?? customer;
    } catch (error) {
      logger.error({ error, companyId, customerId, data }, 'Error updating customer');
      throw error;
    }
  }

  /**
   * Delete customer (soft delete)
   */
  async deleteCustomer(companyId: string, customerId: string) {
    try {
      const customer = await prisma.customer.findFirst({
        where: { id: customerId, companyId },
      });

      if (!customer) {
        throw new Error('Customer not found');
      }

      await prisma.customer.update({
        where: { id: customerId, companyId },
        data: { isActive: false },
      });

      logger.info({ companyId, customerId }, 'Customer deleted');
      return { success: true };
    } catch (error) {
      logger.error({ error, companyId, customerId }, 'Error deleting customer');
      throw error;
    }
  }

  /**
   * Bulk create customers
   */
  async bulkCreateCustomers(
    companyId: string,
    items: CreateCustomerData[]
  ): Promise<BatchResult<any>> {
    return processBatch(
      items,
      async (item) => {
        return await this.createCustomer(companyId, item);
      },
      { batchSize: 50, concurrency: 5, stopOnError: false }
    );
  }

  /**
   * Bulk update customers
   */
  async bulkUpdateCustomers(
    companyId: string,
    items: Array<{ id: string; data: UpdateCustomerData }>
  ): Promise<BatchResult<any>> {
    return processBatch(
      items,
      async (item) => {
        return await this.updateCustomer(companyId, item.id, item.data);
      },
      { batchSize: 50, concurrency: 5, stopOnError: false }
    );
  }

  /**
   * Bulk delete customers
   */
  async bulkDeleteCustomers(
    companyId: string,
    customerIds: string[]
  ): Promise<BatchResult<any>> {
    return processBatch(
      customerIds,
      async (id) => {
        return await this.deleteCustomer(companyId, id);
      },
      { batchSize: 50, concurrency: 5, stopOnError: false }
    );
  }
}

export const customerService = new CustomerService();
