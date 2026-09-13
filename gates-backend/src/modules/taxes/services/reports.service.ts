// @ts-nocheck — strict cleanup pending; tracked for incremental typing.
import prisma from '../../../shared/database/prisma';
import { logger } from '../../../shared/logger';
import { Decimal } from '@prisma/client/runtime/library';

export interface TaxReportFilters {
  companyId: string;
  fromDate?: Date;
  toDate?: Date;
  supplierId?: string;
  accountId?: string;
  branchId?: string;
  status?: string;
  [key: string]: any;
}

export interface TaxReportOptions {
  page?: number;
  limit?: number;
  includeDetails?: boolean;
  includeSummary?: boolean;
}

export interface TaxReportResult {
  data: any[];
  summary?: any;
  pagination?: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export class TaxReportsService {
  /**
   * Get Withholding Notifications Report
   * Lists all withholding tax notifications/notices
   */
  async getWithholdingNotificationsReport(
    filters: TaxReportFilters,
    options: TaxReportOptions = {}
  ): Promise<TaxReportResult> {
    try {
      const { companyId, fromDate, toDate, supplierId, accountId, branchId } = filters;
      const { page = 1, limit = 100, includeDetails = true } = options;

      const where: any = {
        companyId,
        description: {
          contains: 'Withholding Tax',
        },
        isPosted: true,
        isCancelled: false,
      };

      if (fromDate || toDate) {
        where.date = {};
        if (fromDate) where.date.gte = fromDate;
        if (toDate) where.date.lte = toDate;
      }

      if (supplierId) {
        where.description = {
          contains: supplierId,
        };
      }

      if (accountId) {
        where.lines = {
          some: {
            accountId,
          },
        };
      }

      if (branchId) {
        where.branchId = branchId;
      }

      const skip = (page - 1) * limit;

      const [journalEntries, total] = await Promise.all([
        prisma.journalEntry.findMany({
          where,
          skip,
          take: limit,
          orderBy: { date: 'desc' },
          include: includeDetails
            ? {
                lines: {
                  include: {
                    account: {
                      select: {
                        id: true,
                        code: true,
                        arabicName: true,
                      },
                    },
                  },
                },
              }
            : undefined,
        }),
        prisma.journalEntry.count({ where }),
      ]);

      // Calculate summary
      const summary = {
        totalNotifications: total,
        totalTaxAmount: 0,
      };

      if (includeDetails) {
        journalEntries.forEach((entry) => {
          entry.lines?.forEach((line) => {
            if (line.debit && Number(line.debit) > 0) {
              summary.totalTaxAmount += Number(line.debit);
            }
          });
        });
      }

      return {
        data: journalEntries,
        summary,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      };
    } catch (error) {
      logger.error({ error, filters, options }, 'Error generating withholding notifications report');
      throw error;
    }
  }

  /**
   * Get Canceled Withholding Notifications Report
   */
  async getCanceledWithholdingNotificationsReport(
    filters: TaxReportFilters,
    options: TaxReportOptions = {}
  ): Promise<TaxReportResult> {
    try {
      const { companyId, fromDate, toDate, supplierId } = filters;
      const { page = 1, limit = 100 } = options;

      const where: any = {
        companyId,
        description: {
          contains: 'Withholding Tax',
        },
        isCancelled: true,
      };

      if (fromDate || toDate) {
        where.date = {};
        if (fromDate) where.date.gte = fromDate;
        if (toDate) where.date.lte = toDate;
      }

      if (supplierId) {
        where.description = {
          contains: supplierId,
        };
      }

      const skip = (page - 1) * limit;

      const [journalEntries, total] = await Promise.all([
        prisma.journalEntry.findMany({
          where,
          skip,
          take: limit,
          orderBy: { date: 'desc' },
          include: {
            lines: {
              include: {
                account: {
                  select: {
                    id: true,
                    code: true,
                    arabicName: true,
                  },
                },
              },
            },
          },
        }),
        prisma.journalEntry.count({ where }),
      ]);

      return {
        data: journalEntries,
        summary: {
          totalCanceled: total,
        },
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      };
    } catch (error) {
      logger.error({ error, filters, options }, 'Error generating canceled withholding notifications report');
      throw error;
    }
  }

  /**
   * Get Suppliers Ledger Withholding Tax Report
   * Shows withholding tax amounts per supplier
   */
  async getSuppliersLedgerWithholdingTaxReport(
    filters: TaxReportFilters,
    options: TaxReportOptions = {}
  ): Promise<TaxReportResult> {
    try {
      const { companyId, fromDate, toDate, supplierId } = filters;
      const { page = 1, limit = 100 } = options;

      // Get all suppliers
      const suppliersWhere: any = { companyId, isActive: true };
      if (supplierId) {
        suppliersWhere.id = supplierId;
      }

      const suppliers = await prisma.supplier.findMany({
        where: suppliersWhere,
        include: {
          invoices: {
            where: {
              invoiceType: 'purchase',
              isPosted: true,
              isCancelled: false,
              ...(fromDate || toDate
                ? {
                    date: {
                      ...(fromDate ? { gte: fromDate } : {}),
                      ...(toDate ? { lte: toDate } : {}),
                    },
                  }
                : {}),
            },
            include: {
              lines: true,
            },
          },
        },
      });

      // Calculate withholding tax per supplier
      const supplierTaxData = suppliers.map((supplier) => {
        let totalTaxAmount = 0;
        let totalInvoiceAmount = 0;

        supplier.invoices.forEach((invoice) => {
          totalInvoiceAmount += Number(invoice.netAmount || 0);
          // Assuming withholding tax is calculated as a percentage
          // This should be configurable based on tax rules
          const taxRate = 0.05; // 5% default - should come from configuration
          totalTaxAmount += Number(invoice.netAmount || 0) * taxRate;
        });

        return {
          supplierId: supplier.id,
          supplierCode: supplier.code,
          supplierName: supplier.arabicName,
          totalInvoiceAmount,
          totalTaxAmount,
          invoiceCount: supplier.invoices.length,
        };
      });

      const skip = (page - 1) * limit;
      const paginatedData = supplierTaxData.slice(skip, skip + limit);

      return {
        data: paginatedData,
        summary: {
          totalSuppliers: suppliers.length,
          totalTaxAmount: supplierTaxData.reduce((sum, s) => sum + s.totalTaxAmount, 0),
          totalInvoiceAmount: supplierTaxData.reduce((sum, s) => sum + s.totalInvoiceAmount, 0),
        },
        pagination: {
          page,
          limit,
          total: suppliers.length,
          totalPages: Math.ceil(suppliers.length / limit),
        },
      };
    } catch (error) {
      logger.error({ error, filters, options }, 'Error generating suppliers ledger withholding tax report');
      throw error;
    }
  }

  /**
   * Get Withholding Tax Ledger Due Payment Report
   * Shows withholding tax due and payment status
   */
  async getWithholdingTaxLedgerDuePaymentReport(
    filters: TaxReportFilters,
    options: TaxReportOptions = {}
  ): Promise<TaxReportResult> {
    try {
      const { companyId, fromDate, toDate, supplierId } = filters;
      const { page = 1, limit = 100 } = options;

      // Get withholding tax journal entries (due)
      const dueWhere: any = {
        companyId,
        description: {
          contains: 'Withholding Tax',
        },
        isCancelled: false,
      };

      if (fromDate || toDate) {
        dueWhere.date = {};
        if (fromDate) dueWhere.date.gte = fromDate;
        if (toDate) dueWhere.date.lte = toDate;
      }

      const journalEntries = await prisma.journalEntry.findMany({
        where: dueWhere,
        include: {
          lines: {
            include: {
              account: {
                select: {
                  id: true,
                  code: true,
                  arabicName: true,
                },
              },
            },
          },
        },
        orderBy: { date: 'desc' },
      });

      // Process entries to calculate due and paid amounts
      const reportData = journalEntries.map((entry) => {
        let dueAmount = 0;
        let paidAmount = 0;

        entry.lines.forEach((line) => {
          if (line.debit && Number(line.debit) > 0) {
            dueAmount += Number(line.debit);
          }
          if (line.credit && Number(line.credit) > 0) {
            paidAmount += Number(line.credit);
          }
        });

        return {
          entryId: entry.id,
          date: entry.date,
          voucherNumber: entry.voucherNumber,
          description: entry.description,
          dueAmount,
          paidAmount,
          balance: dueAmount - paidAmount,
          status: paidAmount >= dueAmount ? 'paid' : 'partial',
        };
      });

      const skip = (page - 1) * limit;
      const paginatedData = reportData.slice(skip, skip + limit);

      return {
        data: paginatedData,
        summary: {
          totalDue: reportData.reduce((sum, r) => sum + r.dueAmount, 0),
          totalPaid: reportData.reduce((sum, r) => sum + r.paidAmount, 0),
          totalBalance: reportData.reduce((sum, r) => sum + r.balance, 0),
        },
        pagination: {
          page,
          limit,
          total: reportData.length,
          totalPages: Math.ceil(reportData.length / limit),
        },
      };
    } catch (error) {
      logger.error({ error, filters, options }, 'Error generating withholding tax ledger due payment report');
      throw error;
    }
  }

  /**
   * Get VAT Declarations Report
   */
  async getVATDeclarationsReport(
    filters: TaxReportFilters,
    options: TaxReportOptions = {}
  ): Promise<TaxReportResult> {
    try {
      const { companyId, fromDate, toDate } = filters;
      const { page = 1, limit = 100 } = options;

      if (!fromDate || !toDate) {
        throw new Error('From date and to date are required');
      }

      // Get all invoices in the period
      const invoices = await prisma.invoice.findMany({
        where: {
          companyId,
          date: {
            gte: fromDate,
            lte: toDate,
          },
          isPosted: true,
          isCancelled: false,
        },
        include: {
          lines: true,
          customer: {
            select: {
              id: true,
              code: true,
              arabicName: true,
            },
          },
          supplier: {
            select: {
              id: true,
              code: true,
              arabicName: true,
            },
          },
        },
        orderBy: { date: 'desc' },
      });

      // Calculate VAT per invoice
      const vatData = invoices.map((invoice) => {
        let totalVAT = 0;
        let totalAmount = Number(invoice.netAmount || 0);

        invoice.lines.forEach((line) => {
          // Assuming VAT is in taxAmount field
          totalVAT += Number(line.taxAmount || 0);
        });

        return {
          invoiceId: invoice.id,
          invoiceNumber: invoice.invoiceNumber,
          date: invoice.date,
          invoiceType: invoice.invoiceType,
          customerName: invoice.customer?.arabicName,
          supplierName: invoice.supplier?.arabicName,
          totalAmount,
          vatAmount: totalVAT,
          netAmount: totalAmount - totalVAT,
        };
      });

      const skip = (page - 1) * limit;
      const paginatedData = vatData.slice(skip, skip + limit);

      return {
        data: paginatedData,
        summary: {
          totalInvoices: invoices.length,
          totalVAT: vatData.reduce((sum, v) => sum + v.vatAmount, 0),
          totalAmount: vatData.reduce((sum, v) => sum + v.totalAmount, 0),
        },
        pagination: {
          page,
          limit,
          total: vatData.length,
          totalPages: Math.ceil(vatData.length / limit),
        },
      };
    } catch (error) {
      logger.error({ error, filters, options }, 'Error generating VAT declarations report');
      throw error;
    }
  }

  /**
   * Get VAT Notifications Report
   */
  async getVATNotificationsReport(
    filters: TaxReportFilters,
    options: TaxReportOptions = {}
  ): Promise<TaxReportResult> {
    try {
      const { companyId, fromDate, toDate } = filters;
      const { page = 1, limit = 100 } = options;

      // Similar to VAT declarations but focused on notifications/submissions
      // This would typically track VAT submissions to tax authority
      const result = await this.getVATDeclarationsReport(filters, options);

      // Add notification status (would come from tax authority integration)
      const dataWithNotifications = result.data.map((item: any) => ({
        ...item,
        notificationStatus: 'submitted', // Placeholder - should come from actual tax authority API
        notificationDate: item.date,
        notificationNumber: `VAT-${item.invoiceNumber}`,
      }));

      return {
        ...result,
        data: dataWithNotifications,
      };
    } catch (error) {
      logger.error({ error, filters, options }, 'Error generating VAT notifications report');
      throw error;
    }
  }

  /**
   * Get Form 41 Inspection Report
   */
  async getForm41InspectionReport(
    filters: TaxReportFilters,
    options: TaxReportOptions = {}
  ): Promise<TaxReportResult> {
    try {
      const { companyId, fromDate, toDate } = filters;
      const { page = 1, limit = 100 } = options;

      if (!fromDate || !toDate) {
        throw new Error('From date and to date are required');
      }

      // Form 41 is typically a tax inspection form
      // This would check invoices for compliance
      const invoices = await prisma.invoice.findMany({
        where: {
          companyId,
          date: {
            gte: fromDate,
            lte: toDate,
          },
          isPosted: true,
        },
        include: {
          lines: true,
        },
        orderBy: { date: 'desc' },
      });

      // Check compliance issues
      const inspectionData = invoices.map((invoice) => {
        const issues: string[] = [];
        
        // Check if invoice has tax information
        const hasTax = invoice.lines.some((line) => Number(line.taxAmount || 0) > 0);
        if (!hasTax) {
          issues.push('No tax information');
        }

        // Check if invoice is properly formatted
        if (!invoice.invoiceNumber) {
          issues.push('Missing invoice number');
        }

        return {
          invoiceId: invoice.id,
          invoiceNumber: invoice.invoiceNumber,
          date: invoice.date,
          invoiceType: invoice.invoiceType,
          status: issues.length === 0 ? 'compliant' : 'non-compliant',
          issues,
        };
      });

      const skip = (page - 1) * limit;
      const paginatedData = inspectionData.slice(skip, skip + limit);

      return {
        data: paginatedData,
        summary: {
          totalInvoices: invoices.length,
          compliant: inspectionData.filter((i) => i.status === 'compliant').length,
          nonCompliant: inspectionData.filter((i) => i.status === 'non-compliant').length,
        },
        pagination: {
          page,
          limit,
          total: inspectionData.length,
          totalPages: Math.ceil(inspectionData.length / limit),
        },
      };
    } catch (error) {
      logger.error({ error, filters, options }, 'Error generating Form 41 inspection report');
      throw error;
    }
  }

  /**
   * Get Form 41 Payment Receipts Report
   */
  async getForm41PaymentReceiptsReport(
    filters: TaxReportFilters,
    options: TaxReportOptions = {}
  ): Promise<TaxReportResult> {
    try {
      const { companyId, fromDate, toDate } = filters;
      const { page = 1, limit = 100 } = options;

      if (!fromDate || !toDate) {
        throw new Error('From date and to date are required');
      }

      // Get payment receipts related to Form 41
      const journalEntries = await prisma.journalEntry.findMany({
        where: {
          companyId,
          description: {
            contains: 'Form 41',
          },
          date: {
            gte: fromDate,
            lte: toDate,
          },
          isPosted: true,
          isCancelled: false,
        },
        include: {
          lines: {
            include: {
              account: {
                select: {
                  id: true,
                  code: true,
                  arabicName: true,
                },
              },
            },
          },
        },
        orderBy: { date: 'desc' },
      });

      const receiptData = journalEntries.map((entry) => {
        const paymentAmount = entry.lines.reduce((sum, line) => {
          return sum + Number(line.debit || 0);
        }, 0);

        return {
          receiptId: entry.id,
          receiptNumber: entry.voucherNumber,
          date: entry.date,
          description: entry.description,
          paymentAmount,
          status: 'paid',
        };
      });

      const skip = (page - 1) * limit;
      const paginatedData = receiptData.slice(skip, skip + limit);

      return {
        data: paginatedData,
        summary: {
          totalReceipts: journalEntries.length,
          totalPayments: receiptData.reduce((sum, r) => sum + r.paymentAmount, 0),
        },
        pagination: {
          page,
          limit,
          total: receiptData.length,
          totalPages: Math.ceil(receiptData.length / limit),
        },
      };
    } catch (error) {
      logger.error({ error, filters, options }, 'Error generating Form 41 payment receipts report');
      throw error;
    }
  }

  /**
   * Get Non-Withholding Tax Payments Inspection Report
   */
  async getNonWithholdingTaxPaymentsInspectionReport(
    filters: TaxReportFilters,
    options: TaxReportOptions = {}
  ): Promise<TaxReportResult> {
    try {
      const { companyId, fromDate, toDate } = filters;
      const { page = 1, limit = 100 } = options;

      if (!fromDate || !toDate) {
        throw new Error('From date and to date are required');
      }

      // Get payments that are NOT subject to withholding tax
      const payments = await prisma.journalEntry.findMany({
        where: {
          companyId,
          description: {
            not: {
              contains: 'Withholding Tax',
            },
          },
          date: {
            gte: fromDate,
            lte: toDate,
          },
          isPosted: true,
          isCancelled: false,
        },
        include: {
          lines: {
            include: {
              account: {
                select: {
                  id: true,
                  code: true,
                  arabicName: true,
                },
              },
            },
          },
        },
        orderBy: { date: 'desc' },
      });

      const inspectionData = payments.map((payment) => {
        const paymentAmount = payment.lines.reduce((sum, line) => {
          return sum + Number(line.debit || 0);
        }, 0);

        return {
          paymentId: payment.id,
          voucherNumber: payment.voucherNumber,
          date: payment.date,
          description: payment.description,
          paymentAmount,
          status: 'non-withholding',
        };
      });

      const skip = (page - 1) * limit;
      const paginatedData = inspectionData.slice(skip, skip + limit);

      return {
        data: paginatedData,
        summary: {
          totalPayments: payments.length,
          totalAmount: inspectionData.reduce((sum, p) => sum + p.paymentAmount, 0),
        },
        pagination: {
          page,
          limit,
          total: inspectionData.length,
          totalPages: Math.ceil(inspectionData.length / limit),
        },
      };
    } catch (error) {
      logger.error({ error, filters, options }, 'Error generating non-withholding tax payments inspection report');
      throw error;
    }
  }
}

export const taxReportsService = new TaxReportsService();

