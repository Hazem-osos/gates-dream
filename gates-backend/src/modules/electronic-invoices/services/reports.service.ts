import prisma from '../../../shared/database/prisma';
import { logger } from '../../../shared/logger';

export interface ElectronicInvoiceReportFilters {
  companyId: string;
  customerId?: string;
  invoiceType?: 'sales' | 'return' | 'amendment';
  status?: string;
  fromDate?: Date;
  toDate?: Date;
}

export interface ElectronicInvoiceReportOptions {
  page?: number;
  limit?: number;
}

export interface ElectronicInvoiceReportResult {
  data: any[];
  summary?: {
    totalAmount?: number;
    totalTax?: number;
    totalCount?: number;
  };
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export class ElectronicInvoiceReportsService {
  /**
   * Get Sales Invoices Report
   */
  async getSalesInvoicesReport(
    filters: ElectronicInvoiceReportFilters,
    options: ElectronicInvoiceReportOptions = {}
  ): Promise<ElectronicInvoiceReportResult> {
    try {
      const { companyId, customerId, fromDate, toDate } = filters;
      const { page = 1, limit = 100 } = options;

      const where: any = {
        companyId,
        invoiceType: 'sales',
      };

      if (customerId) where.customerId = customerId;
      if (fromDate || toDate) {
        where.invoiceDate = {};
        if (fromDate) where.invoiceDate.gte = fromDate;
        if (toDate) where.invoiceDate.lte = toDate;
      }

      const skip = (page - 1) * limit;

      const [invoices, total] = await Promise.all([
        prisma.electronicInvoice.findMany({
          where,
          skip,
          take: limit,
          orderBy: { invoiceDate: 'desc' },
          include: {
            customer: {
              select: {
                id: true,
                arabicName: true,
                taxNumber: true,
              },
            },
            lines: {
              include: {
                item: true,
              },
            },
          },
        }),
        prisma.electronicInvoice.count({ where }),
      ]);

      const totalAmount = invoices.reduce(
        (sum, invoice) => sum + Number(invoice.totalAmountAfterTax || 0),
        0
      );
      const totalTax = invoices.reduce((sum, invoice) => sum + Number(invoice.totalTax || 0), 0);

      return {
        data: invoices,
        summary: {
          totalAmount,
          totalTax,
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
      logger.error({ error, filters, options }, 'Error generating sales invoices report');
      throw error;
    }
  }

  /**
   * Get Returns Invoices Report
   */
  async getReturnsInvoicesReport(
    filters: ElectronicInvoiceReportFilters,
    options: ElectronicInvoiceReportOptions = {}
  ): Promise<ElectronicInvoiceReportResult> {
    try {
      const { companyId, customerId, fromDate, toDate } = filters;
      const { page = 1, limit = 100 } = options;

      const where: any = {
        companyId,
        invoiceType: 'return',
      };

      if (customerId) where.customerId = customerId;
      if (fromDate || toDate) {
        where.invoiceDate = {};
        if (fromDate) where.invoiceDate.gte = fromDate;
        if (toDate) where.invoiceDate.lte = toDate;
      }

      const skip = (page - 1) * limit;

      const [invoices, total] = await Promise.all([
        prisma.electronicInvoice.findMany({
          where,
          skip,
          take: limit,
          orderBy: { invoiceDate: 'desc' },
          include: {
            customer: {
              select: {
                id: true,
                arabicName: true,
                taxNumber: true,
              },
            },
            lines: {
              include: {
                item: true,
              },
            },
          },
        }),
        prisma.electronicInvoice.count({ where }),
      ]);

      const totalAmount = invoices.reduce(
        (sum, invoice) => sum + Number(invoice.totalAmountAfterTax || 0),
        0
      );
      const totalTax = invoices.reduce((sum, invoice) => sum + Number(invoice.totalTax || 0), 0);

      return {
        data: invoices,
        summary: {
          totalAmount,
          totalTax,
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
      logger.error({ error, filters, options }, 'Error generating returns invoices report');
      throw error;
    }
  }

  /**
   * Get Modified Returns Report
   */
  async getModifiedReturnsReport(
    filters: ElectronicInvoiceReportFilters,
    options: ElectronicInvoiceReportOptions = {}
  ): Promise<ElectronicInvoiceReportResult> {
    try {
      const { companyId, customerId, fromDate, toDate } = filters;
      const { page = 1, limit = 100 } = options;

      const where: any = {
        companyId,
        invoiceType: 'amendment',
      };

      if (customerId) where.customerId = customerId;
      if (fromDate || toDate) {
        where.invoiceDate = {};
        if (fromDate) where.invoiceDate.gte = fromDate;
        if (toDate) where.invoiceDate.lte = toDate;
      }

      const skip = (page - 1) * limit;

      const [invoices, total] = await Promise.all([
        prisma.electronicInvoice.findMany({
          where,
          skip,
          take: limit,
          orderBy: { invoiceDate: 'desc' },
          include: {
            customer: {
              select: {
                id: true,
                arabicName: true,
                taxNumber: true,
              },
            },
            lines: {
              include: {
                item: true,
              },
            },
          },
        }),
        prisma.electronicInvoice.count({ where }),
      ]);

      const totalAmount = invoices.reduce(
        (sum, invoice) => sum + Number(invoice.totalAmountAfterTax || 0),
        0
      );
      const totalTax = invoices.reduce((sum, invoice) => sum + Number(invoice.totalTax || 0), 0);

      return {
        data: invoices,
        summary: {
          totalAmount,
          totalTax,
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
      logger.error({ error, filters, options }, 'Error generating modified returns report');
      throw error;
    }
  }
}

export const electronicInvoiceReportsService = new ElectronicInvoiceReportsService();

