// @ts-nocheck — strict cleanup pending; tracked for incremental typing.
import { logger } from '../../../shared/logger';
import prisma from '../../../shared/database/prisma';

export interface RenumberOperationsOptions {
  operationType: 'journal-entry' | 'invoice' | 'treasury-receipt' | 'treasury-payment';
  fromDate?: Date;
  toDate?: Date;
  startNumber: number;
  companyId: string;
}

export class RenumberOperationsService {
  /**
   * Renumber operations sequentially
   */
  async renumberOperations(options: RenumberOperationsOptions): Promise<{ renumbered: number }> {
    try {
      let renumbered = 0;

      if (options.operationType === 'journal-entry') {
        const where: any = {
          companyId: options.companyId,
        };

        if (options.fromDate) {
          where.date = { gte: options.fromDate };
        }
        if (options.toDate) {
          where.date = { ...where.date, lte: options.toDate };
        }

        const entries = await prisma.journalEntry.findMany({
          where,
          orderBy: { date: 'asc' },
        });

        let currentNumber = options.startNumber;
        for (const entry of entries) {
          const voucherNumber = String(currentNumber).padStart(6, '0');
          await prisma.journalEntry.update({
            where: { id: entry.id },
            data: { voucherNumber },
          });
          currentNumber++;
          renumbered++;
        }
      } else if (options.operationType === 'invoice') {
        const where: any = {
          companyId: options.companyId,
        };

        if (options.fromDate) {
          where.date = { gte: options.fromDate };
        }
        if (options.toDate) {
          where.date = { ...where.date, lte: options.toDate };
        }

        const invoices = await prisma.invoice.findMany({
          where,
          orderBy: { date: 'asc' },
        });

        let currentNumber = options.startNumber;
        for (const invoice of invoices) {
          const invoiceNumber = String(currentNumber).padStart(6, '0');
          await prisma.invoice.update({
            where: { id: invoice.id },
            data: { invoiceNumber: invoiceNumber },
          });
          currentNumber++;
          renumbered++;
        }
      } else if (options.operationType === 'treasury-receipt') {
        const where: any = {
          companyId: options.companyId,
        };

        if (options.fromDate) {
          where.date = { gte: options.fromDate };
        }
        if (options.toDate) {
          where.date = { ...where.date, lte: options.toDate };
        }

        const receipts = await prisma.treasuryReceipt.findMany({
          where,
          orderBy: { date: 'asc' },
        });

        let currentNumber = options.startNumber;
        for (const receipt of receipts) {
          const receiptNumber = String(currentNumber).padStart(6, '0');
          await prisma.treasuryReceipt.update({
            where: { id: receipt.id },
            data: { receiptNumber: receiptNumber },
          });
          currentNumber++;
          renumbered++;
        }
      } else if (options.operationType === 'treasury-payment') {
        const where: any = {
          companyId: options.companyId,
        };

        if (options.fromDate) {
          where.date = { gte: options.fromDate };
        }
        if (options.toDate) {
          where.date = { ...where.date, lte: options.toDate };
        }

        const payments = await prisma.treasuryPayment.findMany({
          where,
          orderBy: { date: 'asc' },
        });

        let currentNumber = options.startNumber;
        for (const payment of payments) {
          const paymentNumber = String(currentNumber).padStart(6, '0');
          await prisma.treasuryPayment.update({
            where: { id: payment.id },
            data: { paymentNumber: paymentNumber },
          });
          currentNumber++;
          renumbered++;
        }
      }

      logger.info({ renumbered, options }, 'Operations renumbered');

      return { renumbered };
    } catch (error) {
      logger.error({ error, options }, 'Error renumbering operations');
      throw error;
    }
  }
}

export const renumberOperationsService = new RenumberOperationsService();

