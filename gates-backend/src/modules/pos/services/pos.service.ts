// @ts-nocheck — strict cleanup pending; tracked for incremental typing.
import prisma from '../../../shared/database/prisma';
import { logger } from '../../../shared/logger';
import { AppError } from '../../../shared/middleware/error-handler';

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

export const POS_HISTORICAL_INVOICE_LIMITATION =
  'Posted PosOrder rows are the current POS report. Historical /pos/sales invoices are ordinary sales invoices with no POS marker, so they are not included and are not guessed.';

export class POSService {
  /**
   * Retired. POS financial writes go through PosOrder posting only.
   * Shared invoice and stock services stay available to the rest of Gates.
   */
  async createPOSSale(companyId: string, userId: string, data: CreatePOSSaleData) {
    throw new AppError(410, 'مسار نقطة البيع القديم متوقف. الترحيل يتم من أمر نقطة البيع فقط.');
  }

  /**
   * Get POS sale by ID
   */
  async getPOSSaleById(companyId: string, saleId: string) {
    throw new AppError(410, 'مسار نقطة البيع القديم متوقف. الترحيل يتم من أمر نقطة البيع فقط.');
  }

  /**
   * List POS sales with filters
   */
  async listPOSSales(
    _companyId: string,
    _options: {
      page?: number;
      limit?: number;
      fromDate?: Date;
      toDate?: Date;
      warehouseId?: string;
      sellerId?: string;
      customerId?: string;
    }
  ) {
    throw new AppError(410, 'مسار نقطة البيع القديم متوقف. الترحيل يتم من أمر نقطة البيع فقط.');
  }

  /**
   * Daily POS activity from posted PosOrder rows only.
   * `sellerId` filters `postedBy` (the cashier on the post), not invoice seller.
   * Sales invoices are not unioned: legacy /pos/sales rows have no POS marker.
   */
  async getDailyPOSReport(filters: POSDailyReportFilters) {
    try {
      const { companyId, date, warehouseId, sellerId } = filters;

      const startOfDay = new Date(date);
      startOfDay.setHours(0, 0, 0, 0);

      const endOfDay = new Date(date);
      endOfDay.setHours(23, 59, 59, 999);

      const orders = await prisma.posOrder.findMany({
        where: {
          companyId,
          status: 'POSTED',
          postedAt: { gte: startOfDay, lte: endOfDay },
          ...(sellerId ? { postedBy: sellerId } : {}),
          ...(warehouseId ? { shift: { terminal: { warehouseId } } } : {}),
        },
        include: {
          customer: { select: { id: true, code: true, arabicName: true } },
          lines: {
            include: { item: { select: { id: true, arabicName: true } } },
          },
          shift: {
            include: {
              terminal: {
                include: { warehouse: { select: { id: true, code: true, arabicName: true } } },
              },
            },
          },
        },
        orderBy: [{ postedAt: 'asc' }],
      });

      const sales = orders.map((order) => {
        const cash = Number(order.cashAmount);
        const card = Number(order.cardAmount);
        const credit = Number(order.creditAmount);
        const cogs = order.lines.reduce(
          (sum, line) => sum + Number(line.quantity) * Number(line.unitCost),
          0
        );
        return {
          id: order.id,
          invoiceNumber: order.orderNumber,
          orderNumber: order.orderNumber,
          date: order.postedAt,
          warehouse: order.shift.terminal.warehouse,
          customer: order.customer,
          paymentMethod: order.paymentMethod,
          paymentType: order.paymentMethod,
          description: order.orderType === 'RETURN' ? 'مرتجع نقطة بيع' : 'مبيعات نقطة بيع',
          currencyCode: order.currencyCode,
          totalAmount: Number(order.totalAmount),
          discountAmount: Number(order.discountAmount),
          taxAmount: Number(order.taxAmount),
          netAmount: Number(order.netAmount),
          paidAmount: cash + card,
          remainingAmount: credit,
          journalEntryId: order.journalEntryId,
          cogs,
          status: order.status,
          lines: order.lines,
        };
      });

      const summary = {
        totalSales: sales.length,
        totalAmount: sales.reduce((sum, row) => sum + row.netAmount, 0),
        totalPaid: sales.reduce((sum, row) => sum + row.paidAmount, 0),
        totalRemaining: sales.reduce((sum, row) => sum + row.remainingAmount, 0),
        totalItems: sales.reduce(
          (sum, row) => sum + row.lines.reduce((lineSum, line) => lineSum + Number(line.quantity), 0),
          0
        ),
        totalCogs: sales.reduce((sum, row) => sum + row.cogs, 0),
        source: 'POS_ORDER',
      };

      return {
        date,
        sales,
        summary,
        historicalLimitation: POS_HISTORICAL_INVOICE_LIMITATION,
      };
    } catch (error) {
      logger.error({ error, filters }, 'Error generating daily POS report');
      throw error;
    }
  }

  /** Hub metrics: recently posted PosOrder rows for this company. Not sales invoices. */
  async listPostedPosOrders(companyId: string, limit = 50) {
    const take = Math.min(Math.max(limit, 1), 50);
    const orders = await prisma.posOrder.findMany({
      where: { companyId, status: 'POSTED' },
      orderBy: { postedAt: 'desc' },
      take,
      select: {
        id: true,
        orderNumber: true,
        netAmount: true,
        cashAmount: true,
        cardAmount: true,
        creditAmount: true,
        postedAt: true,
        journalEntryId: true,
        status: true,
      },
    });
    const rows = orders.map((order) => ({
      id: order.id,
      orderNumber: order.orderNumber,
      netAmount: Number(order.netAmount),
      paidAmount: Number(order.cashAmount) + Number(order.cardAmount),
      remainingAmount: Number(order.creditAmount),
      postedAt: order.postedAt,
      journalEntryId: order.journalEntryId,
      status: order.status,
    }));
    return {
      rows,
      summary: {
        count: rows.length,
        net: rows.reduce((sum, row) => sum + row.netAmount, 0),
        paid: rows.reduce((sum, row) => sum + row.paidAmount, 0),
        remaining: rows.reduce((sum, row) => sum + row.remainingAmount, 0),
        source: 'POS_ORDER' as const,
      },
      historicalLimitation: POS_HISTORICAL_INVOICE_LIMITATION,
    };
  }

  /**
   * Cancel POS sale (create return invoice)
   */
  async cancelPOSSale(
    companyId: string,
    saleId: string,
    reason?: string
  ) {
    throw new AppError(410, 'مسار نقطة البيع القديم متوقف. الترحيل يتم من أمر نقطة البيع فقط.');
  }

  /**
   * Print receipt for POS sale
   */
  async printReceipt(companyId: string, saleId: string) {
    throw new AppError(410, 'مسار نقطة البيع القديم متوقف. الترحيل يتم من أمر نقطة البيع فقط.');
  }

  /**
   * Update inventory in real-time for POS operations
   */
  async updateInventoryRealTime(companyId: string, warehouseId: string, itemId: string, quantityChange: number) {
    throw new AppError(410, 'مسار نقطة البيع القديم متوقف. الترحيل يتم من أمر نقطة البيع فقط.');
  }
}

export const posService = new POSService();

