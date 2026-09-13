import prisma from '../../../shared/database/prisma';
import { logger } from '../../../shared/logger';

export interface CreateCustomerFollowupData {
  customerId: string;
  propertyId?: string;
  followupDate: Date;
  followupType?: string;
  notes?: string;
  status?: string;
  nextFollowupDate?: Date;
}

export interface UpdateCustomerFollowupData extends Partial<CreateCustomerFollowupData> {}

export class CustomerFollowupService {
  async createFollowup(companyId: string, data: CreateCustomerFollowupData) {
    try {
      const customer = await prisma.customer.findFirst({
        where: { id: data.customerId, companyId, deletedAt: null },
        select: { id: true },
      });
      if (!customer) {
        throw new Error('Customer not found');
      }

      const followup = await prisma.customerFollowup.create({
        data: {
          companyId,
          customerId: data.customerId,
          propertyId: data.propertyId ?? null,
          followupDate: data.followupDate,
          followupType: data.followupType ?? null,
          followupData: data.notes ?? null,
          nextFollowupDate: data.nextFollowupDate ?? null,
          status: data.status ?? 'active',
          notes: data.notes ?? null,
        },
      });

      logger.info({ companyId, followupId: followup.id }, 'Customer followup created');
      return followup;
    } catch (error) {
      logger.error({ error, companyId }, 'Error creating customer followup');
      throw error;
    }
  }

  async listFollowups(
    companyId: string,
    options: {
      page?: number;
      limit?: number;
      customerId?: string;
      propertyId?: string;
      fromDate?: Date;
      toDate?: Date;
    } = {}
  ) {
    try {
      const page = options.page ?? 1;
      const limit = Math.min(options.limit ?? 50, 200);
      const skip = (page - 1) * limit;

      const where: {
        companyId: string;
        customerId?: string;
        propertyId?: string;
        followupDate?: { gte?: Date; lte?: Date };
      } = { companyId };

      if (options.customerId) where.customerId = options.customerId;
      if (options.propertyId) where.propertyId = options.propertyId;
      if (options.fromDate || options.toDate) {
        where.followupDate = {};
        if (options.fromDate) where.followupDate.gte = options.fromDate;
        if (options.toDate) where.followupDate.lte = options.toDate;
      }

      const [followups, total] = await Promise.all([
        prisma.customerFollowup.findMany({
          where,
          orderBy: { followupDate: 'desc' },
          skip,
          take: limit,
        }),
        prisma.customerFollowup.count({ where }),
      ]);

      return {
        followups,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit) || 0,
        },
      };
    } catch (error) {
      logger.error({ error, companyId }, 'Error listing customer followups');
      throw error;
    }
  }
}

export const customerFollowupService = new CustomerFollowupService();
