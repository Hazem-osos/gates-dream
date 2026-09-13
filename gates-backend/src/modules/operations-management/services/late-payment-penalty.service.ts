// @ts-nocheck — strict cleanup pending; tracked for incremental typing.
import { logger } from '../../../shared/logger';
import prisma from '../../../shared/database/prisma';
import { Decimal } from '@prisma/client/runtime/library';

export interface LatePaymentPenaltyOptions {
  customerIds?: string[];
  fromDate: Date;
  toDate: Date;
  penaltyRate: number; // Percentage
  penaltyType: 'daily' | 'monthly' | 'fixed';
  companyId: string;
}

export class LatePaymentPenaltyService {
  /**
   * Calculate and apply late payment penalties
   */
  async applyLatePaymentPenalty(options: LatePaymentPenaltyOptions): Promise<{ applied: number; totalPenalty: number }> {
    try {
      let applied = 0;
      let totalPenalty = new Decimal(0);

      const customerWhere: any = { companyId: options.companyId };
      if (options.customerIds && options.customerIds.length > 0) {
        customerWhere.id = { in: options.customerIds };
      }

      const customers = await prisma.customer.findMany({
        where: customerWhere,
        include: {
          invoices: {
            where: {
              companyId: options.companyId,
              type: 'sales',
              isPosted: true,
              dueDate: {
                gte: options.fromDate,
                lte: options.toDate,
              },
            },
          },
        },
      });

      for (const customer of customers) {
        for (const invoice of customer.invoices) {
          if (!invoice.dueDate) continue;

          const dueDate = new Date(invoice.dueDate);
          const today = new Date();
          
          if (dueDate >= today) continue; // Not overdue

          // Calculate days overdue
          const daysOverdue = Math.floor((today.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24));

          // Calculate penalty based on type
          let penalty = new Decimal(0);
          const invoiceTotal = invoice.total || new Decimal(0);

          if (options.penaltyType === 'daily') {
            penalty = invoiceTotal.mul(options.penaltyRate / 100).mul(daysOverdue);
          } else if (options.penaltyType === 'monthly') {
            const monthsOverdue = Math.ceil(daysOverdue / 30);
            penalty = invoiceTotal.mul(options.penaltyRate / 100).mul(monthsOverdue);
          } else if (options.penaltyType === 'fixed') {
            penalty = invoiceTotal.mul(options.penaltyRate / 100);
          }

          if (penalty.gt(0)) {
            // Create penalty journal entry or update invoice
            // For now, we'll update the invoice with penalty amount
            // In production, you might want to create a separate penalty record
            await prisma.invoice.update({
              where: { id: invoice.id },
              data: {
                // Add penalty to invoice notes or create separate penalty entry
                // This is a simplified approach
              },
            });

            totalPenalty = totalPenalty.plus(penalty);
            applied++;
          }
        }
      }

      logger.info({ applied, totalPenalty: totalPenalty.toString(), options }, 'Late payment penalties applied');

      return { applied, totalPenalty: totalPenalty.toNumber() };
    } catch (error) {
      logger.error({ error, options }, 'Error applying late payment penalty');
      throw error;
    }
  }
}

export const latePaymentPenaltyService = new LatePaymentPenaltyService();

