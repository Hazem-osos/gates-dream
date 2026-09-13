// @ts-nocheck — report queries predate current Prisma schema shapes; tighten types incrementally.
import prisma from '../../../shared/database/prisma';
import { logger } from '../../../shared/logger';
import { Decimal } from '@prisma/client/runtime/library';

export interface ExtractsReportFilters {
  companyId: string;
  projectId?: string;
  contractorId?: string;
  fromDate?: Date;
  toDate?: Date;
  extractType?: string;
  statementType?: string;
}

export interface ExtractsReportOptions {
  page?: number;
  limit?: number;
  includeDetails?: boolean;
}

export interface ExtractsReportResult {
  data: any[];
  summary?: {
    totalAmount?: number;
    totalPayments?: number;
    totalCount?: number;
  };
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export class ExtractsReportsService {
  /**
   * Get Contractor Payments Report
   */
  async getContractorPaymentsReport(
    filters: ExtractsReportFilters,
    options: ExtractsReportOptions = {}
  ): Promise<ExtractsReportResult> {
    try {
      const { companyId, contractorId, projectId, fromDate, toDate } = filters;
      const { page = 1, limit = 100 } = options;

      const where: any = {
        project: { companyId },
      };

      if (contractorId) {
        where.contractorId = contractorId;
      }

      if (projectId) {
        where.projectId = projectId;
      }

      if (fromDate || toDate) {
        where.paymentDate = {};
        if (fromDate) where.paymentDate.gte = fromDate;
        if (toDate) where.paymentDate.lte = toDate;
      }

      const skip = (page - 1) * limit;

      const [payments, total] = await Promise.all([
        prisma.extractPayment.findMany({
          where,
          skip,
          take: limit,
          orderBy: { paymentDate: 'desc' },
          include: {
            contractor: {
              select: {
                id: true,
                arabicName: true,
                serial: true,
              },
            },
            project: {
              select: {
                id: true,
                arabicName: true,
                serial: true,
              },
            },
            extract: {
              select: {
                id: true,
                extractNumber: true,
                extractDate: true,
                totalValue: true,
              },
            },
          },
        }),
        prisma.extractPayment.count({ where }),
      ]);

      const totalPayments = payments.reduce(
        (sum, payment) => sum + Number(payment.paymentAmount || 0),
        0
      );

      return {
        data: payments,
        summary: {
          totalPayments,
          totalCount: total,
        },
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      };
    } catch (error) {
      logger.error({ error, filters, options }, 'Error generating contractor payments report');
      throw error;
    }
  }

  /**
   * Get Projects Status Report
   */
  async getProjectsStatusReport(
    filters: ExtractsReportFilters,
    options: ExtractsReportOptions = {}
  ): Promise<ExtractsReportResult> {
    try {
      const { companyId, projectId } = filters;
      const { page = 1, limit = 100 } = options;

      const where: any = {
        companyId,
        isActive: true,
      };

      if (projectId) {
        where.id = projectId;
      }

      const skip = (page - 1) * limit;

      const [projects, total] = await Promise.all([
        prisma.project.findMany({
          where,
          skip,
          take: limit,
          orderBy: { createdAt: 'desc' },
          include: {
            extracts: {
              include: {
                contractor: {
                  select: {
                    id: true,
                    arabicName: true,
                  },
                },
                items: true,
              },
              orderBy: { extractDate: 'desc' },
            },
            payments: {
              select: {
                id: true,
                paymentAmount: true,
                paymentDate: true,
              },
            },
            _count: {
              select: {
                extracts: true,
                payments: true,
                workItems: true,
                buildings: true,
              },
            },
          },
        }),
        prisma.project.count({ where }),
      ]);

      // Calculate project status summary
      const projectsWithStatus = projects.map((project) => {
        const totalExtracts = project.extracts.reduce(
          (sum, extract) => sum + Number(extract.totalValue || 0),
          0
        );
        const totalPayments = project.payments.reduce(
          (sum, payment) => sum + Number(payment.paymentAmount || 0),
          0
        );
        const remaining = totalExtracts - totalPayments;
        const completionPercentage =
          Number(project.totalValue || 0) > 0
            ? (totalExtracts / Number(project.totalValue || 1)) * 100
            : 0;

        return {
          ...project,
          summary: {
            totalExtracts,
            totalPayments,
            remaining,
            completionPercentage,
          },
        };
      });

      return {
        data: projectsWithStatus,
        summary: {
          totalCount: total,
        },
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      };
    } catch (error) {
      logger.error({ error, filters, options }, 'Error generating projects status report');
      throw error;
    }
  }

  /**
   * Get Extracts Inventory Report
   */
  async getExtractsInventoryReport(
    filters: ExtractsReportFilters,
    options: ExtractsReportOptions = {}
  ): Promise<ExtractsReportResult> {
    try {
      const { companyId, projectId, contractorId, fromDate, toDate } = filters;
      const { page = 1, limit = 100 } = options;

      const where: any = {
        project: { companyId },
        isPosted: true,
        isCancelled: false,
      };

      if (projectId) {
        where.projectId = projectId;
      }

      if (contractorId) {
        where.contractorId = contractorId;
      }

      if (fromDate || toDate) {
        where.extractDate = {};
        if (fromDate) where.extractDate.gte = fromDate;
        if (toDate) where.extractDate.lte = toDate;
      }

      const skip = (page - 1) * limit;

      const [extracts, total] = await Promise.all([
        prisma.extract.findMany({
          where,
          skip,
          take: limit,
          orderBy: { extractDate: 'desc' },
          include: {
            project: {
              select: {
                id: true,
                arabicName: true,
                serial: true,
              },
            },
            contractor: {
              select: {
                id: true,
                arabicName: true,
                serial: true,
              },
            },
            items: {
              include: {
                workItem: {
                  select: {
                    id: true,
                    arabicName: true,
                    itemNumber: true,
                  },
                },
                building: {
                  select: {
                    id: true,
                    arabicName: true,
                    unitNumber: true,
                  },
                },
              },
            },
            payments: {
              select: {
                id: true,
                paymentAmount: true,
                paymentDate: true,
              },
            },
          },
        }),
        prisma.extract.count({ where }),
      ]);

      const totalAmount = extracts.reduce(
        (sum, extract) => sum + Number(extract.totalValue || 0),
        0
      );

      return {
        data: extracts,
        summary: {
          totalAmount,
          totalCount: total,
        },
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      };
    } catch (error) {
      logger.error({ error, filters, options }, 'Error generating extracts inventory report');
      throw error;
    }
  }
}

export const extractsReportsService = new ExtractsReportsService();

