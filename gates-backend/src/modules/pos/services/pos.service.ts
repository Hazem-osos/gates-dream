// @ts-nocheck — strict cleanup pending; tracked for incremental typing.
import prisma from '../../../shared/database/prisma';
import { logger } from '../../../shared/logger';
import { Decimal } from '@prisma/client/runtime/library';
import { scopedItemQuantityWhere } from '../../inventory/utils/item-quantity-tenant';
import { invoiceService } from '../../inventory/services/invoice.service';
import { adjustStockInTx } from '../../inventory/services/adjust-stock-in-tx';

export interface POSLineData {
  itemId: string;
  unitId: string;
  quantity: number;
  baseQuantity: number;
  price: number;
  discountPercent?: number;
  discountAmount?: number;
  taxPercent?: number;
  taxAmount?: number;
  lineOrder: number;
}

export interface CreatePOSSaleData {
  invoiceNumber?: string;
  date: Date;
  hijriDate?: string;
  description?: string;
  currencyCode: string;
  customerId?: string;
  warehouseId: string;
  sellerId?: string;
  paymentMethod: 'cash' | 'card' | 'multiple';
  payments?: Array<{
    method: 'cash' | 'card' | 'other';
    amount: number;
  }>;
  lines: POSLineData[];
}

export interface POSDailyReportFilters {
  companyId: string;
  date: Date;
  warehouseId?: string;
  sellerId?: string;
}

export class POSService {
  /**
   * Create a POS sale (sales invoice with immediate posting)
   */
  async createPOSSale(companyId: string, userId: string, data: CreatePOSSaleData) {
    try {
      // Create sales invoice
      const invoice = await invoiceService.createInvoice(companyId, {
        invoiceNumber: data.invoiceNumber,
        invoiceType: 'sales',
        date: data.date,
        hijriDate: data.hijriDate,
        description: data.description || 'POS Sale',
        currencyCode: data.currencyCode,
        customerId: data.customerId,
        warehouseId: data.warehouseId,
        sellerId: data.sellerId,
        paymentMethod: data.paymentMethod,
        lines: data.lines,
      });

      // Immediately post the invoice (POS sales are posted immediately)
      await invoiceService.postInvoice(companyId, invoice.id);

      // Process payments if provided
      if (data.payments && data.payments.length > 0) {
        const totalPaid = data.payments.reduce((sum, p) => sum + p.amount, 0);
        await invoiceService.collectPayment(companyId, invoice.id, totalPaid);
      } else {
        // If no payments specified, mark as fully paid
        const netAmount = Number(invoice.netAmount);
        await invoiceService.collectPayment(companyId, invoice.id, netAmount);
      }

      // Fetch updated invoice
      const updatedInvoice = await invoiceService.getInvoiceById(companyId, invoice.id);

      logger.info(
        { companyId, invoiceId: invoice.id, userId },
        'POS sale created and posted'
      );

      return updatedInvoice;
    } catch (error) {
      logger.error({ error, companyId, data }, 'Error creating POS sale');
      throw error;
    }
  }

  /**
   * Get POS sale by ID
   */
  async getPOSSaleById(companyId: string, saleId: string) {
    try {
      const invoice = await invoiceService.getInvoiceById(companyId, saleId);

      if (invoice.invoiceType !== 'sales') {
        throw new Error('Invoice is not a sales invoice');
      }

      return invoice;
    } catch (error) {
      logger.error({ error, companyId, saleId }, 'Error getting POS sale');
      throw error;
    }
  }

  /**
   * List POS sales with filters
   */
  async listPOSSales(
    companyId: string,
    options: {
      page?: number;
      limit?: number;
      fromDate?: Date;
      toDate?: Date;
      warehouseId?: string;
      sellerId?: string;
      customerId?: string;
    }
  ) {
    try {
      const result = await invoiceService.listInvoices(companyId, {
        page: options.page,
        limit: options.limit,
        invoiceType: 'sales',
        fromDate: options.fromDate,
        toDate: options.toDate,
        warehouseId: options.warehouseId,
        sellerId: options.sellerId,
        customerId: options.customerId,
        isPosted: true, // POS sales are always posted
      });

      return result;
    } catch (error) {
      logger.error({ error, companyId, options }, 'Error listing POS sales');
      throw error;
    }
  }

  /**
   * Get daily POS report
   */
  async getDailyPOSReport(filters: POSDailyReportFilters) {
    try {
      const { companyId, date, warehouseId, sellerId } = filters;

      const startOfDay = new Date(date);
      startOfDay.setHours(0, 0, 0, 0);

      const endOfDay = new Date(date);
      endOfDay.setHours(23, 59, 59, 999);

      const where: any = {
        companyId,
        invoiceType: 'sales',
        date: {
          gte: startOfDay,
          lte: endOfDay,
        },
        isPosted: true,
        isCancelled: false,
      };

      if (warehouseId) {
        where.warehouseId = warehouseId;
      }

      if (sellerId) {
        where.sellerId = sellerId;
      }

      const invoices = await prisma.invoice.findMany({
        where,
        include: {
          customer: {
            select: {
              id: true,
              code: true,
              arabicName: true,
            },
          },
          warehouse: {
            select: {
              id: true,
              code: true,
              arabicName: true,
            },
          },
          lines: {
            include: {
              item: {
                select: {
                  id: true,
                  code: true,
                  arabicName: true,
                },
              },
            },
          },
        },
        orderBy: [{ date: 'asc' }],
      });

      const summary = {
        totalSales: invoices.length,
        totalAmount: invoices.reduce(
          (sum, inv) => sum + Number(inv.netAmount),
          0
        ),
        totalPaid: invoices.reduce(
          (sum, inv) => sum + Number(inv.paidAmount),
          0
        ),
        totalRemaining: invoices.reduce(
          (sum, inv) => sum + Number(inv.remainingAmount),
          0
        ),
        totalItems: invoices.reduce(
          (sum, inv) =>
            sum + inv.lines.reduce((lineSum, line) => lineSum + Number(line.quantity), 0),
          0
        ),
      };

      return {
        date,
        sales: invoices,
        summary,
      };
    } catch (error) {
      logger.error({ error, filters }, 'Error generating daily POS report');
      throw error;
    }
  }

  /**
   * Cancel POS sale (create return invoice)
   */
  async cancelPOSSale(
    companyId: string,
    saleId: string,
    reason?: string
  ) {
    try {
      const originalSale = await invoiceService.getInvoiceById(companyId, saleId);

      if (originalSale.invoiceType !== 'sales') {
        throw new Error('Invoice is not a sales invoice');
      }

      if (!originalSale.isPosted) {
        // If not posted, just cancel it
        return await invoiceService.cancelInvoice(companyId, saleId);
      }

      // If posted, create a return invoice
      const returnInvoice = await invoiceService.createInvoice(companyId, {
        invoiceType: 'return',
        date: new Date(),
        description: reason || `Return for invoice ${originalSale.invoiceNumber}`,
        currencyCode: originalSale.currencyCode,
        customerId: originalSale.customerId || undefined,
        warehouseId: originalSale.warehouseId,
        sellerId: originalSale.sellerId || undefined,
        lines: originalSale.lines.map((line) => ({
          itemId: line.itemId,
          unitId: line.unitId,
          quantity: Number(line.quantity),
          baseQuantity: Number(line.baseQuantity),
          price: Number(line.price),
          discountPercent: line.discountPercent
            ? Number(line.discountPercent)
            : undefined,
          discountAmount: line.discountAmount
            ? Number(line.discountAmount)
            : undefined,
          taxPercent: line.taxPercent ? Number(line.taxPercent) : undefined,
          taxAmount: line.taxAmount ? Number(line.taxAmount) : undefined,
          lineOrder: line.lineOrder,
        })),
      });

      // Post the return invoice
      await invoiceService.postInvoice(companyId, returnInvoice.id);

      logger.info(
        { companyId, originalSaleId: saleId, returnInvoiceId: returnInvoice.id },
        'POS sale cancelled via return invoice'
      );

      return returnInvoice;
    } catch (error) {
      logger.error({ error, companyId, saleId }, 'Error cancelling POS sale');
      throw error;
    }
  }

  /**
   * Print receipt for POS sale
   */
  async printReceipt(companyId: string, saleId: string) {
    try {
      const invoice = await invoiceService.getInvoiceById(companyId, saleId);

      if (invoice.invoiceType !== 'sales') {
        throw new Error('Invoice is not a sales invoice');
      }

      // Generate receipt data (in real implementation, this would format for printer)
      const receiptData = {
        invoiceNumber: invoice.invoiceNumber,
        date: invoice.date,
        customer: invoice.customer,
        lines: invoice.lines,
        totalAmount: invoice.totalAmount,
        netAmount: invoice.netAmount,
        taxAmount: invoice.taxAmount,
        discountAmount: invoice.discountAmount,
      };

      logger.info({ companyId, saleId }, 'Receipt generated for POS sale');

      // In a real implementation, this would:
      // 1. Format receipt for thermal printer
      // 2. Send to printer queue
      // 3. Return receipt data for display/printing

      return {
        receiptData,
        printJobId: `print-${saleId}`, // Placeholder
      };
    } catch (error) {
      logger.error({ error, companyId, saleId }, 'Error printing receipt');
      throw error;
    }
  }

  /**
   * Update inventory in real-time for POS operations
   */
  async updateInventoryRealTime(companyId: string, warehouseId: string, itemId: string, quantityChange: number) {
    try {
      return await prisma.$transaction(async (tx) => {
        const itemQuantity = await tx.itemQuantity.findFirst({
          where: scopedItemQuantityWhere(companyId, {
            warehouseId,
            itemId,
          }),
        });

        if (!itemQuantity) {
          throw new Error('Item quantity not found');
        }

        const currentQuantity = Number(itemQuantity.quantity || 0);
        const newQuantity = currentQuantity + quantityChange;

        if (newQuantity < 0) {
          throw new Error('Insufficient inventory');
        }

        await tx.itemQuantity.update({
          where: { id: itemQuantity.id },
          data: { quantity: new Decimal(newQuantity) },
        });

        const warehouseBal = await adjustStockInTx(tx, {
          companyId,
          itemId,
          warehouseId,
          deltaQty: quantityChange,
        });

        logger.info(
          { companyId, warehouseId, itemId, quantityChange, newQuantity },
          'Inventory updated in real-time'
        );

        return {
          itemId,
          warehouseId,
          previousQuantity: currentQuantity,
          newQuantity: warehouseBal.quantityOnHand,
          quantityChange,
          reservedQuantity: warehouseBal.reservedQuantity,
        };
      });
    } catch (error) {
      logger.error({ error, companyId, warehouseId, itemId }, 'Error updating inventory in real-time');
      throw error;
    }
  }
}

export const posService = new POSService();

