import prisma from '../../../shared/database/prisma';
import { logger } from '../../../shared/logger';

export interface CreateElectronicInvoiceCustomerData {
  customerId?: string;
  taxNumber: string;
  arabicName: string;
  englishName?: string;
  address?: string;
  city?: string;
  country?: string;
  phone?: string;
  email?: string;
  registrationNumber?: string;
  commercialRegistration?: string;
}

export class ElectronicInvoiceCustomerService {
  async createCustomer(companyId: string, data: CreateElectronicInvoiceCustomerData) {
    try {
      const customer = await prisma.electronicInvoiceCustomer.create({
        data: {
          companyId,
          customerId: data.customerId,
          taxNumber: data.taxNumber,
          arabicName: data.arabicName,
          englishName: data.englishName,
          address: data.address,
          city: data.city,
          country: data.country,
          phone: data.phone,
          email: data.email,
          registrationNumber: data.registrationNumber,
          commercialRegistration: data.commercialRegistration,
        },
        include: {
          customer: {
            select: {
              id: true,
              arabicName: true,
              code: true,
            },
          },
        },
      });

      logger.info({ companyId, customerId: customer.id }, 'Electronic invoice customer created');
      return customer;
    } catch (error) {
      logger.error({ error, companyId }, 'Error creating electronic invoice customer');
      throw error;
    }
  }

  async listCustomers(
    companyId: string,
    options: {
      page?: number;
      limit?: number;
      search?: string;
      isActive?: boolean;
    } = {}
  ) {
    try {
      const page = options.page || 1;
      const limit = options.limit || 50;
      const skip = (page - 1) * limit;

      const where: any = { companyId };

      if (options.isActive !== undefined) {
        where.isActive = options.isActive;
      }

      if (options.search) {
        where.OR = [
          { arabicName: { contains: options.search } },
          { englishName: { contains: options.search } },
          { taxNumber: { contains: options.search } },
        ];
      }

      const [customers, total] = await Promise.all([
        prisma.electronicInvoiceCustomer.findMany({
          where,
          skip,
          take: limit,
          orderBy: { createdAt: 'desc' },
          include: {
            customer: {
              select: {
                id: true,
                arabicName: true,
                code: true,
              },
            },
          },
        }),
        prisma.electronicInvoiceCustomer.count({ where }),
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
      logger.error({ error, companyId }, 'Error listing electronic invoice customers');
      throw error;
    }
  }

  async getCustomerById(companyId: string, id: string) {
    try {
      const customer = await prisma.electronicInvoiceCustomer.findFirst({
        where: { id, companyId },
        include: {
          customer: true,
        },
      });

      if (!customer) {
        throw new Error('Electronic invoice customer not found');
      }

      return customer;
    } catch (error) {
      logger.error({ error, companyId, customerId: id }, 'Error getting electronic invoice customer');
      throw error;
    }
  }

  async updateCustomer(companyId: string, id: string, data: Partial<CreateElectronicInvoiceCustomerData>) {
    try {
      const existing = await prisma.electronicInvoiceCustomer.findFirst({
        where: { id, companyId },
      });

      if (!existing) {
        throw new Error('Electronic invoice customer not found');
      }

      const customer = await prisma.electronicInvoiceCustomer.update({
        where: { id },
        data: {
          customerId: data.customerId,
          taxNumber: data.taxNumber,
          arabicName: data.arabicName,
          englishName: data.englishName,
          address: data.address,
          city: data.city,
          country: data.country,
          phone: data.phone,
          email: data.email,
          registrationNumber: data.registrationNumber,
          commercialRegistration: data.commercialRegistration,
        },
      });

      logger.info({ companyId, customerId: id }, 'Electronic invoice customer updated');
      return customer;
    } catch (error) {
      logger.error({ error, companyId, customerId: id }, 'Error updating electronic invoice customer');
      throw error;
    }
  }

  async deleteCustomer(companyId: string, id: string) {
    try {
      const customer = await prisma.electronicInvoiceCustomer.findFirst({
        where: { id, companyId },
      });

      if (!customer) {
        throw new Error('Electronic invoice customer not found');
      }

      await prisma.electronicInvoiceCustomer.delete({
        where: { id },
      });

      logger.info({ companyId, customerId: id }, 'Electronic invoice customer deleted');
    } catch (error) {
      logger.error({ error, companyId, customerId: id }, 'Error deleting electronic invoice customer');
      throw error;
    }
  }
}

export const electronicInvoiceCustomerService = new ElectronicInvoiceCustomerService();

