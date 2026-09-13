// @ts-nocheck — strict cleanup pending; tracked for incremental typing.
import prisma from '../../../shared/database/prisma';
import { logger } from '../../../shared/logger';
import { Decimal } from '@prisma/client/runtime/library';
import { taxSignatureService } from '../../taxes/services/tax-signature.service';

export interface CreateElectronicInvoiceData {
  branchId?: string;
  customerId: string;
  invoiceType?: 'sales' | 'return' | 'amendment';
  invoiceNumber?: string;
  invoiceDate: Date;
  hijriDate?: string;
  lines: Array<{
    itemId?: string;
    itemCode: string;
    arabicName: string;
    englishName?: string;
    quantity: number;
    unitCode?: string;
    unitName?: string;
    unitPrice: number;
    totalPrice: number;
    taxType?: string;
    taxRate?: number;
    taxAmount: number;
    discountAmount?: number;
    totalAfterTax: number;
  }>;
  discountAmount?: number;
  notes?: string;
}

export interface UpdateElectronicInvoiceData extends Partial<CreateElectronicInvoiceData> {
  status?: 'draft' | 'submitted' | 'approved' | 'rejected' | 'cancelled';
}

export class ElectronicInvoiceService {
  /**
   * Get company seller information for electronic invoices
   */
  private async getCompanySellerInfo(companyId: string): Promise<{ name: string; taxNumber: string }> {
    try {
      const company = await prisma.company.findUnique({
        where: { id: companyId },
        select: {
          arabicName: true,
          englishName: true,
          taxNumber1: true,
          taxNumber2: true,
          taxNumber3: true,
        },
      });

      if (!company) {
        throw new Error('Company not found');
      }

      // Use Arabic name if available, otherwise English name
      const name = company.arabicName || company.englishName || 'Company Name';
      
      // Use first available tax number
      const taxNumber = company.taxNumber1 || company.taxNumber2 || company.taxNumber3 || '';

      return {
        name,
        taxNumber,
      };
    } catch (error) {
      logger.error({ error, companyId }, 'Error getting company seller info');
      // Return fallback values
      return {
        name: 'Company Name',
        taxNumber: '',
      };
    }
  }

  async createInvoice(companyId: string, data: CreateElectronicInvoiceData) {
    try {
      // Verify customer exists
      const customer = await prisma.electronicInvoiceCustomer.findFirst({
        where: { id: data.customerId, companyId },
      });

      if (!customer) {
        throw new Error('Electronic invoice customer not found');
      }

      // Calculate totals
      const totalAmount = data.lines.reduce((sum, line) => sum + line.totalPrice, 0);
      const totalTax = data.lines.reduce((sum, line) => sum + line.taxAmount, 0);
      const totalDiscount = data.discountAmount || 0;
      const totalAmountAfterTax = data.lines.reduce((sum, line) => sum + line.totalAfterTax, 0) - totalDiscount;

      const invoice = await prisma.electronicInvoice.create({
        data: {
          companyId,
          branchId: data.branchId,
          customerId: data.customerId,
          invoiceType: data.invoiceType || 'sales',
          invoiceNumber: data.invoiceNumber,
          invoiceDate: data.invoiceDate,
          hijriDate: data.hijriDate,
          totalAmount: new Decimal(totalAmount),
          totalTax: new Decimal(totalTax),
          totalAmountAfterTax: new Decimal(totalAmountAfterTax),
          discountAmount: totalDiscount > 0 ? new Decimal(totalDiscount) : null,
          notes: data.notes,
          lines: {
            create: data.lines.map((line, index) => ({
              itemId: line.itemId,
              itemCode: line.itemCode,
              arabicName: line.arabicName,
              englishName: line.englishName,
              quantity: new Decimal(line.quantity),
              unitCode: line.unitCode,
              unitName: line.unitName,
              unitPrice: new Decimal(line.unitPrice),
              totalPrice: new Decimal(line.totalPrice),
              taxType: line.taxType,
              taxRate: line.taxRate ? new Decimal(line.taxRate) : null,
              taxAmount: new Decimal(line.taxAmount),
              discountAmount: line.discountAmount ? new Decimal(line.discountAmount) : null,
              totalAfterTax: new Decimal(line.totalAfterTax),
              lineNumber: index + 1,
            })),
          },
        },
        include: {
          customer: true,
          lines: {
            include: {
              item: true,
            },
          },
        },
      });

      logger.info({ companyId, invoiceId: invoice.id }, 'Electronic invoice created');
      return invoice;
    } catch (error) {
      logger.error({ error, companyId }, 'Error creating electronic invoice');
      throw error;
    }
  }

  async listInvoices(
    companyId: string,
    options: {
      page?: number;
      limit?: number;
      customerId?: string;
      invoiceType?: string;
      status?: string;
      fromDate?: Date;
      toDate?: Date;
    } = {}
  ) {
    try {
      const page = options.page || 1;
      const limit = options.limit || 50;
      const skip = (page - 1) * limit;

      const where: any = { companyId };

      if (options.customerId) where.customerId = options.customerId;
      if (options.invoiceType) where.invoiceType = options.invoiceType;
      if (options.status) where.status = options.status;
      if (options.fromDate || options.toDate) {
        where.invoiceDate = {};
        if (options.fromDate) where.invoiceDate.gte = options.fromDate;
        if (options.toDate) where.invoiceDate.lte = options.toDate;
      }

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
            _count: {
              select: {
                lines: true,
              },
            },
          },
        }),
        prisma.electronicInvoice.count({ where }),
      ]);

      return {
        invoices,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      };
    } catch (error) {
      logger.error({ error, companyId }, 'Error listing electronic invoices');
      throw error;
    }
  }

  async getInvoiceById(companyId: string, id: string) {
    try {
      const invoice = await prisma.electronicInvoice.findFirst({
        where: { id, companyId },
        include: {
          customer: true,
          lines: {
            include: {
              item: true,
            },
            orderBy: { lineNumber: 'asc' },
          },
        },
      });

      if (!invoice) {
        throw new Error('Electronic invoice not found');
      }

      return invoice;
    } catch (error) {
      logger.error({ error, companyId, invoiceId: id }, 'Error getting electronic invoice');
      throw error;
    }
  }

  async updateInvoice(companyId: string, id: string, data: UpdateElectronicInvoiceData) {
    try {
      const existing = await prisma.electronicInvoice.findFirst({
        where: { id, companyId },
      });

      if (!existing) {
        throw new Error('Electronic invoice not found');
      }

      // Don't allow updates if already submitted/approved
      if (existing.status === 'submitted' || existing.status === 'approved') {
        throw new Error('Cannot update invoice that is already submitted or approved');
      }

      const updateData: any = {};

      if (data.status !== undefined) updateData.status = data.status;
      if (data.invoiceDate !== undefined) updateData.invoiceDate = data.invoiceDate;
      if (data.hijriDate !== undefined) updateData.hijriDate = data.hijriDate;
      if (data.notes !== undefined) updateData.notes = data.notes;

      if (data.lines) {
        // Delete existing lines and create new ones
        await prisma.electronicInvoiceLine.deleteMany({
          where: { invoiceId: id },
        });

        const totalAmount = data.lines.reduce((sum, line) => sum + line.totalPrice, 0);
        const totalTax = data.lines.reduce((sum, line) => sum + line.taxAmount, 0);
        const totalDiscount = data.discountAmount || 0;
        const totalAmountAfterTax =
          data.lines.reduce((sum, line) => sum + line.totalAfterTax, 0) - totalDiscount;

        updateData.totalAmount = new Decimal(totalAmount);
        updateData.totalTax = new Decimal(totalTax);
        updateData.totalAmountAfterTax = new Decimal(totalAmountAfterTax);
        updateData.discountAmount = totalDiscount > 0 ? new Decimal(totalDiscount) : null;

        updateData.lines = {
          create: data.lines.map((line, index) => ({
            itemId: line.itemId,
            itemCode: line.itemCode,
            arabicName: line.arabicName,
            englishName: line.englishName,
            quantity: new Decimal(line.quantity),
            unitCode: line.unitCode,
            unitName: line.unitName,
            unitPrice: new Decimal(line.unitPrice),
            totalPrice: new Decimal(line.totalPrice),
            taxType: line.taxType,
            taxRate: line.taxRate ? new Decimal(line.taxRate) : null,
            taxAmount: new Decimal(line.taxAmount),
            discountAmount: line.discountAmount ? new Decimal(line.discountAmount) : null,
            totalAfterTax: new Decimal(line.totalAfterTax),
            lineNumber: index + 1,
          })),
        };
      }

      const invoice = await prisma.electronicInvoice.update({
        where: { id },
        data: updateData,
        include: {
          customer: true,
          lines: {
            include: {
              item: true,
            },
          },
        },
      });

      logger.info({ companyId, invoiceId: id }, 'Electronic invoice updated');
      return invoice;
    } catch (error) {
      logger.error({ error, companyId, invoiceId: id }, 'Error updating electronic invoice');
      throw error;
    }
  }

  async deleteInvoice(companyId: string, id: string) {
    try {
      const invoice = await prisma.electronicInvoice.findFirst({
        where: { id, companyId },
      });

      if (!invoice) {
        throw new Error('Electronic invoice not found');
      }

      // Don't allow deletion if already submitted/approved
      if (invoice.status === 'submitted' || invoice.status === 'approved') {
        throw new Error('Cannot delete invoice that is already submitted or approved');
      }

      await prisma.electronicInvoice.delete({
        where: { id },
      });

      logger.info({ companyId, invoiceId: id }, 'Electronic invoice deleted');
    } catch (error) {
      logger.error({ error, companyId, invoiceId: id }, 'Error deleting electronic invoice');
      throw error;
    }
  }

  /**
   * Send invoice to tax authority (ETA/ZATCA)
   */
  async sendInvoice(companyId: string, id: string) {
    try {
      const invoice = await prisma.electronicInvoice.findFirst({
        where: { id, companyId },
        include: {
          customer: true,
          lines: {
            include: {
              item: true,
            },
            orderBy: { lineNumber: 'asc' },
          },
        },
      });

      if (!invoice) {
        throw new Error('Electronic invoice not found');
      }

      if (invoice.status !== 'draft') {
        throw new Error('Invoice must be in draft status to send');
      }

      // Prepare invoice data for tax signature service
      const taxInvoice = {
        invoiceNumber: invoice.invoiceNumber || invoice.id,
        invoiceDate: invoice.invoiceDate.toISOString(),
        totalAmount: Number(invoice.totalAmount),
        taxAmount: Number(invoice.totalTax),
        items: invoice.lines.map((line) => ({
          name: line.arabicName,
          quantity: Number(line.quantity),
          unitPrice: Number(line.unitPrice),
          taxRate: Number(line.taxRate || 0),
        })),
        seller: await this.getCompanySellerInfo(companyId),
        buyer: {
          name: invoice.customer.arabicName,
          taxNumber: invoice.customer.taxNumber,
        },
      };

      // Sign invoice
      const signedInvoice = taxSignatureService.signInvoice(taxInvoice);

      // Submit to tax authority
      const submissionId = await taxSignatureService.submitInvoice(signedInvoice);

      // Update invoice with submission details
      const updated = await prisma.electronicInvoice.update({
        where: { id },
        data: {
          status: 'submitted',
          submissionDate: new Date(),
          uuid: signedInvoice.hash, // Store UUID from ETA/ZATCA
          longId: submissionId,
        },
      });

      logger.info({ companyId, invoiceId: id, submissionId }, 'Electronic invoice sent');
      return updated;
    } catch (error) {
      logger.error({ error, companyId, invoiceId: id }, 'Error sending electronic invoice');
      throw error;
    }
  }

  /**
   * Send return invoice
   */
  async sendReturn(companyId: string, originalInvoiceId: string, returnData: CreateElectronicInvoiceData) {
    try {
      // Verify original invoice exists
      const originalInvoice = await prisma.electronicInvoice.findFirst({
        where: { id: originalInvoiceId, companyId },
      });

      if (!originalInvoice) {
        throw new Error('Original invoice not found');
      }

      // Create return invoice
      const returnInvoice = await this.createInvoice(companyId, {
        ...returnData,
        invoiceType: 'return',
        invoiceNumber: `RET-${originalInvoice.invoiceNumber || originalInvoice.id}`,
      });

      // Send the return invoice
      await this.sendInvoice(companyId, returnInvoice.id);

      return returnInvoice;
    } catch (error) {
      logger.error({ error, companyId, originalInvoiceId }, 'Error sending return invoice');
      throw error;
    }
  }

  /**
   * Send amendment invoice
   */
  async sendAmendment(companyId: string, originalInvoiceId: string, amendmentData: CreateElectronicInvoiceData) {
    try {
      // Verify original invoice exists
      const originalInvoice = await prisma.electronicInvoice.findFirst({
        where: { id: originalInvoiceId, companyId },
      });

      if (!originalInvoice) {
        throw new Error('Original invoice not found');
      }

      // Create amendment invoice
      const amendmentInvoice = await this.createInvoice(companyId, {
        ...amendmentData,
        invoiceType: 'amendment',
        invoiceNumber: `AMEND-${originalInvoice.invoiceNumber || originalInvoice.id}`,
      });

      // Send the amendment invoice
      await this.sendInvoice(companyId, amendmentInvoice.id);

      return amendmentInvoice;
    } catch (error) {
      logger.error({ error, companyId, originalInvoiceId }, 'Error sending amendment invoice');
      throw error;
    }
  }
}

export const electronicInvoiceService = new ElectronicInvoiceService();

