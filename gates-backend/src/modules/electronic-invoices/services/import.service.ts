import prisma from '../../../shared/database/prisma';
import { logger } from '../../../shared/logger';
import { Decimal } from '@prisma/client/runtime/library';
import { electronicInvoiceService } from './invoice.service';

export interface ImportTaxInvoiceData {
  invoiceNumber: string;
  invoiceDate: Date;
  customerTaxNumber: string;
  customerName: string;
  lines: Array<{
    itemCode: string;
    itemName: string;
    quantity: number;
    unitPrice: number;
    taxRate?: number;
  }>;
}

export class ElectronicInvoiceImportService {
  /**
   * Import tax invoices from external source (CSV, Excel, API)
   */
  async importTaxInvoices(
    companyId: string,
    invoices: ImportTaxInvoiceData[],
    options: {
      autoCreateCustomers?: boolean;
      autoCreateItems?: boolean;
    } = {}
  ) {
    try {
      const results = {
        success: [] as any[],
        failed: [] as Array<{ invoice: ImportTaxInvoiceData; error: string }>,
      };

      for (const invoiceData of invoices) {
        try {
          // Find or create customer
          let customer = await prisma.electronicInvoiceCustomer.findFirst({
            where: {
              companyId,
              taxNumber: invoiceData.customerTaxNumber,
            },
          });

          if (!customer && options.autoCreateCustomers) {
            customer = await prisma.electronicInvoiceCustomer.create({
              data: {
                companyId,
                taxNumber: invoiceData.customerTaxNumber,
                arabicName: invoiceData.customerName,
              },
            });
          }

          if (!customer) {
            throw new Error(`Customer not found: ${invoiceData.customerTaxNumber}`);
          }

          // Prepare invoice lines
          const lines = await Promise.all(
            invoiceData.lines.map(async (line) => {
              // Find or create item if needed
              let itemId: string | undefined;
              if (options.autoCreateItems) {
                let item = await prisma.electronicInvoiceItem.findFirst({
                  where: {
                    companyId,
                    itemCode: line.itemCode,
                  },
                });

                if (!item) {
                  item = await prisma.electronicInvoiceItem.create({
                    data: {
                      companyId,
                      itemCode: line.itemCode,
                      arabicName: line.itemName,
                    },
                  });
                }
                itemId = item.id;
              }

              const unitPrice = line.unitPrice;
              const totalPrice = unitPrice * line.quantity;
              const taxRate = line.taxRate || 0;
              const taxAmount = (totalPrice * taxRate) / 100;
              const totalAfterTax = totalPrice + taxAmount;

              return {
                itemId,
                itemCode: line.itemCode,
                arabicName: line.itemName,
                quantity: line.quantity,
                unitPrice,
                totalPrice,
                taxType: taxRate > 0 ? 'VAT' : 'ZERO',
                taxRate,
                taxAmount,
                totalAfterTax,
              };
            })
          );

          // Calculate totals
          const totalAmount = lines.reduce((sum, line) => sum + line.totalPrice, 0);
          const totalTax = lines.reduce((sum, line) => sum + line.taxAmount, 0);
          const totalAmountAfterTax = lines.reduce((sum, line) => sum + line.totalAfterTax, 0);

          // Create invoice
          const invoice = await prisma.electronicInvoice.create({
            data: {
              companyId,
              customerId: customer.id,
              invoiceType: 'sales',
              invoiceNumber: invoiceData.invoiceNumber,
              invoiceDate: invoiceData.invoiceDate,
              totalAmount: new Decimal(totalAmount),
              totalTax: new Decimal(totalTax),
              totalAmountAfterTax: new Decimal(totalAmountAfterTax),
              status: 'draft',
              lines: {
                create: lines.map((line, index) => ({
                  itemId: line.itemId,
                  itemCode: line.itemCode,
                  arabicName: line.arabicName,
                  quantity: new Decimal(line.quantity),
                  unitPrice: new Decimal(line.unitPrice),
                  totalPrice: new Decimal(line.totalPrice),
                  taxType: line.taxType,
                  taxRate: line.taxRate ? new Decimal(line.taxRate) : null,
                  taxAmount: new Decimal(line.taxAmount),
                  totalAfterTax: new Decimal(line.totalAfterTax),
                  lineNumber: index + 1,
                })),
              },
            },
            include: {
              customer: true,
              lines: true,
            },
          });

          results.success.push(invoice);
        } catch (error) {
          logger.error({ error, invoiceData }, 'Error importing invoice');
          results.failed.push({
            invoice: invoiceData,
            error: error instanceof Error ? error.message : 'Unknown error',
          });
        }
      }

      logger.info(
        { companyId, successCount: results.success.length, failedCount: results.failed.length },
        'Tax invoices import completed'
      );

      return results;
    } catch (error) {
      logger.error({ error, companyId }, 'Error importing tax invoices');
      throw error;
    }
  }
}

export const electronicInvoiceImportService = new ElectronicInvoiceImportService();

