import prisma from '../../../shared/database/prisma';
import { logger } from '../../../shared/logger';
import { CreateCustomerContractInput, UpdateCustomerContractInput } from '../schemas/customer-contract.schema';

export class CustomerContractService {
  /**
   * Create a new customer contract
   */
  async createCustomerContract(companyId: string, data: CreateCustomerContractInput) {
    try {
      const contract = await prisma.customerContract.create({
        data: {
          companyId,
          code: data.code,
          customerId: data.customerId,
          operationsCenterId: data.operationsCenterId,
          contractType: data.contractType,
          cashPercentage: data.cashPercentage,
          creditPercentage: data.creditPercentage,
          daysCount: data.daysCount,
          groups: {
            create: (data.groups || []).map((group) => ({
              categoryId: group.categoryId || null,
              groupNumber: group.groupNumber || null,
              groupName: group.groupName || null,
              days: group.days ?? null,
            })),
          },
        },
        include: {
          customer: {
            select: {
              id: true,
              code: true,
              arabicName: true,
              englishName: true,
            },
          },
          groups: {
            include: {
              category: { select: { id: true, code: true, arabicName: true } },
            },
          },
        },
      });

      logger.info({ companyId, contractId: contract.id }, 'Customer contract created');
      return contract;
    } catch (error) {
      logger.error({ error, companyId, data }, 'Error creating customer contract');
      throw error;
    }
  }

  /**
   * Get customer contract by ID
   */
  async getCustomerContractById(companyId: string, contractId: string) {
    try {
      const contract = await prisma.customerContract.findFirst({
        where: {
          id: contractId,
          companyId,
        },
        include: {
          customer: {
            select: {
              id: true,
              code: true,
              arabicName: true,
              englishName: true,
            },
          },
          groups: {
            orderBy: { createdAt: 'asc' },
            include: {
              category: { select: { id: true, code: true, arabicName: true } },
            },
          },
        },
      });

      if (!contract) {
        throw new Error('Customer contract not found');
      }

      return contract;
    } catch (error) {
      logger.error({ error, companyId, contractId }, 'Error getting customer contract');
      throw error;
    }
  }

  /**
   * List customer contracts
   */
  async listCustomerContracts(
    companyId: string,
    options: {
      page?: number;
      limit?: number;
      search?: string;
      customerId?: string;
      contractType?: string;
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
          { code: { contains: options.search } },
          { customer: { arabicName: { contains: options.search } } },
          { customer: { englishName: { contains: options.search } } },
        ];
      }

      if (options.customerId) {
        where.customerId = options.customerId;
      }

      if (options.contractType) {
        where.contractType = options.contractType;
      }

      if (options.isActive !== undefined) {
        where.isActive = options.isActive;
      }

      const [contracts, total] = await Promise.all([
        prisma.customerContract.findMany({
          where,
          skip,
          take: limit,
          orderBy: [{ createdAt: 'desc' }],
          include: {
            customer: {
              select: {
                id: true,
                code: true,
                arabicName: true,
                englishName: true,
              },
            },
            _count: { select: { groups: true } },
          },
        }),
        prisma.customerContract.count({ where }),
      ]);

      return {
        contracts,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      };
    } catch (error) {
      logger.error({ error, companyId, options }, 'Error listing customer contracts');
      throw error;
    }
  }

  /**
   * Update customer contract
   */
  async updateCustomerContract(
    companyId: string,
    contractId: string,
    data: UpdateCustomerContractInput
  ) {
    try {
      const existing = await prisma.customerContract.findFirst({
        where: { id: contractId, companyId },
      });

      if (!existing) {
        throw new Error('Customer contract not found');
      }

      // Update contract
      const contract = await prisma.customerContract.update({
        where: { id: contractId },
        data: {
          ...(data.code !== undefined && { code: data.code }),
          ...(data.customerId && { customerId: data.customerId }),
          ...(data.operationsCenterId !== undefined && { operationsCenterId: data.operationsCenterId }),
          ...(data.contractType !== undefined && { contractType: data.contractType }),
          ...(data.cashPercentage !== undefined && { cashPercentage: data.cashPercentage }),
          ...(data.creditPercentage !== undefined && { creditPercentage: data.creditPercentage }),
          ...(data.daysCount !== undefined && { daysCount: data.daysCount }),
          ...(data.isActive !== undefined && { isActive: data.isActive }),
        },
        include: {
          customer: {
            select: {
              id: true,
              code: true,
              arabicName: true,
              englishName: true,
            },
          },
          groups: {
            orderBy: { createdAt: 'asc' },
            include: {
              category: { select: { id: true, code: true, arabicName: true } },
            },
          },
        },
      });

      // Update groups if provided
      if (data.groups) {
        // Delete existing groups
        await prisma.customerContractGroup.deleteMany({
          where: { customerContractId: contractId },
        });

        // Create new groups
        if (data.groups.length > 0) {
          await prisma.customerContractGroup.createMany({
            data: data.groups.map((group) => ({
              customerContractId: contractId,
              categoryId: group.categoryId || null,
              groupNumber: group.groupNumber || null,
              groupName: group.groupName || null,
              days: group.days ?? null,
            })),
          });
        }

        // Reload with updated groups
        return this.getCustomerContractById(companyId, contractId);
      }

      logger.info({ companyId, contractId }, 'Customer contract updated');
      return contract;
    } catch (error) {
      logger.error(
        { error, companyId, contractId, data },
        'Error updating customer contract'
      );
      throw error;
    }
  }

  /**
   * Permanent delete
   */
  async deleteCustomerContract(companyId: string, contractId: string) {
    try {
      const contract = await prisma.customerContract.findFirst({
        where: { id: contractId, companyId },
      });

      if (!contract) {
        throw new Error('Customer contract not found');
      }

      await prisma.customerContract.delete({ where: { id: contractId } });

      logger.info({ companyId, contractId }, 'Customer contract permanently deleted');
      return { success: true };
    } catch (error) {
      logger.error({ error, companyId, contractId }, 'Error deleting customer contract');
      throw error;
    }
  }
}

export const customerContractService = new CustomerContractService();

