import prisma from '../../../shared/database/prisma';
import { logger } from '../../../shared/logger';

export interface CreateContractorData {
  serial?: string;
  arabicName: string;
  englishName?: string;
  taxNumber?: string;
  phone?: string;
  address?: string;
  notes?: string;
}

export interface UpdateContractorData extends Partial<CreateContractorData> {
  isActive?: boolean;
}

export interface ContractorSettingsData {
  advancePaymentPercentage?: number;
  workInsurancePercentage?: number;
  taxDeductionPercentage?: number;
  otherSettings?: Record<string, any>;
}

export class ContractorService {
  async createContractor(companyId: string, data: CreateContractorData) {
    try {
      const contractor = await prisma.contractor.create({
        data: {
          companyId,
          serial: data.serial,
          arabicName: data.arabicName,
          englishName: data.englishName,
          taxNumber: data.taxNumber,
          phone: data.phone,
          address: data.address,
          notes: data.notes,
        },
        include: {
          _count: {
            select: {
              assignments: true,
              extractPayments: true,
            },
          },
        },
      });

      logger.info({ companyId, contractorId: contractor.id }, 'Contractor created');
      return contractor;
    } catch (error) {
      logger.error({ error, companyId }, 'Error creating contractor');
      throw error;
    }
  }

  async listContractors(
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
          { serial: { contains: options.search } },
          { taxNumber: { contains: options.search } },
        ];
      }

      const [contractors, total] = await Promise.all([
        prisma.contractor.findMany({
          where,
          skip,
          take: limit,
          orderBy: { createdAt: 'desc' },
          include: {
            _count: {
              select: {
                assignments: true,
                extractPayments: true,
              },
            },
          },
        }),
        prisma.contractor.count({ where }),
      ]);

      return {
        contractors,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      };
    } catch (error) {
      logger.error({ error, companyId }, 'Error listing contractors');
      throw error;
    }
  }

  async getContractorById(companyId: string, id: string) {
    try {
      const contractor = await prisma.contractor.findFirst({
        where: { id, companyId },
        include: {
          assignments: {
            include: {
              project: true,
              workItem: true,
            },
          },
          extractPayments: {
            include: {
              extract: true,
              project: true,
            },
            orderBy: { paymentDate: 'desc' },
            take: 10,
          },
          contractorSettings: true,
        },
      });

      if (!contractor) {
        throw new Error('Contractor not found');
      }

      return contractor;
    } catch (error) {
      logger.error({ error, companyId, contractorId: id }, 'Error getting contractor');
      throw error;
    }
  }

  async updateContractor(companyId: string, id: string, data: UpdateContractorData) {
    try {
      const existing = await prisma.contractor.findFirst({
        where: { id, companyId },
      });

      if (!existing) {
        throw new Error('Contractor not found');
      }

      const contractor = await prisma.contractor.update({
        where: { id },
        data: {
          arabicName: data.arabicName,
          englishName: data.englishName,
          serial: data.serial,
          taxNumber: data.taxNumber,
          phone: data.phone,
          address: data.address,
          notes: data.notes,
          isActive: data.isActive,
        },
      });

      logger.info({ companyId, contractorId: id }, 'Contractor updated');
      return contractor;
    } catch (error) {
      logger.error({ error, companyId, contractorId: id }, 'Error updating contractor');
      throw error;
    }
  }

  async deleteContractor(companyId: string, id: string) {
    try {
      const contractor = await prisma.contractor.findFirst({
        where: { id, companyId },
      });

      if (!contractor) {
        throw new Error('Contractor not found');
      }

      await prisma.contractor.delete({
        where: { id },
      });

      logger.info({ companyId, contractorId: id }, 'Contractor deleted');
    } catch (error) {
      logger.error({ error, companyId, contractorId: id }, 'Error deleting contractor');
      throw error;
    }
  }

  async getContractorSettings(companyId: string, contractorId: string) {
    try {
      // Verify contractor exists and belongs to company
      const contractor = await prisma.contractor.findFirst({
        where: { id: contractorId, companyId },
      });

      if (!contractor) {
        throw new Error('Contractor not found');
      }

      const settings = await prisma.contractorSettings.findUnique({
        where: { contractorId },
      });

      return settings;
    } catch (error) {
      logger.error({ error, companyId, contractorId }, 'Error getting contractor settings');
      throw error;
    }
  }

  async updateContractorSettings(
    companyId: string,
    contractorId: string,
    data: ContractorSettingsData
  ) {
    try {
      // Verify contractor exists and belongs to company
      const contractor = await prisma.contractor.findFirst({
        where: { id: contractorId, companyId },
      });

      if (!contractor) {
        throw new Error('Contractor not found');
      }

      const settings = await prisma.contractorSettings.upsert({
        where: { contractorId },
        update: {
          advancePaymentPercentage: data.advancePaymentPercentage,
          workInsurancePercentage: data.workInsurancePercentage,
          taxDeductionPercentage: data.taxDeductionPercentage,
          otherSettings: data.otherSettings,
        },
        create: {
          contractorId,
          advancePaymentPercentage: data.advancePaymentPercentage,
          workInsurancePercentage: data.workInsurancePercentage,
          taxDeductionPercentage: data.taxDeductionPercentage,
          otherSettings: data.otherSettings,
        },
      });

      logger.info({ companyId, contractorId }, 'Contractor settings updated');
      return settings;
    } catch (error) {
      logger.error({ error, companyId, contractorId }, 'Error updating contractor settings');
      throw error;
    }
  }

  async deleteContractorSettings(companyId: string, contractorId: string) {
    try {
      // Verify contractor exists and belongs to company
      const contractor = await prisma.contractor.findFirst({
        where: { id: contractorId, companyId },
      });

      if (!contractor) {
        throw new Error('Contractor not found');
      }

      await prisma.contractorSettings.delete({
        where: { contractorId },
      }).catch(() => {
        // Ignore if settings don't exist
      });

      logger.info({ companyId, contractorId }, 'Contractor settings deleted');
    } catch (error) {
      logger.error({ error, companyId, contractorId }, 'Error deleting contractor settings');
      throw error;
    }
  }
}

export const contractorService = new ContractorService();

