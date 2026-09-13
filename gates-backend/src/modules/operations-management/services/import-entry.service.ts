// @ts-nocheck — strict cleanup pending; tracked for incremental typing.
import * as fs from 'fs/promises';
import { logger } from '../../../shared/logger';
import prisma from '../../../shared/database/prisma';
import { journalEntryService } from '../../accounting/services/journal-entry.service';
import { invoiceService } from '../../inventory/services/invoice.service';
import { treasuryReceiptService } from '../../accounting/services/treasury-receipt.service';
import { treasuryPaymentService } from '../../accounting/services/treasury-payment.service';

export interface ImportEntryOptions {
  file: string;
  format: 'csv' | 'excel' | 'json';
  entryType: 'journal-entry' | 'invoice' | 'treasury-receipt' | 'treasury-payment';
  validateBeforeImport: boolean;
  companyId: string;
  userId: string; // Required for treasury operations
}

export class ImportEntryService {
  /**
   * Import entries from file
   */
  async importEntry(options: ImportEntryOptions): Promise<{ imported: number; failed: number; errors: string[] }> {
    try {
      const fileContent = await fs.readFile(options.file, 'utf-8');
      let entries: any[] = [];

      // Parse file based on format
      if (options.format === 'json') {
        entries = JSON.parse(fileContent);
      } else if (options.format === 'csv') {
        entries = this.parseCSV(fileContent);
      } else if (options.format === 'excel') {
        // For Excel, you'd need a library like 'xlsx'
        // For now, treat as CSV
        entries = this.parseCSV(fileContent);
      }

      let imported = 0;
      let failed = 0;
      const errors: string[] = [];

      // Import each entry
      for (const entry of entries) {
        try {
          if (options.entryType === 'journal-entry') {
            // Transform entry data to match CreateJournalEntryData interface
            await journalEntryService.createJournalEntry(options.companyId, {
              voucherNumber: entry.voucherNumber,
              date: new Date(entry.date),
              hijriDate: entry.hijriDate,
              description: entry.description,
              currencyCode: entry.currencyCode || 'EGP',
              isCyclic: entry.isCyclic || false,
              lines: entry.lines || [],
            });
            imported++;
          } else if (options.entryType === 'invoice') {
            // Transform entry data to match CreateInvoiceData interface
            await invoiceService.createInvoice(options.companyId, {
              invoiceNumber: entry.invoiceNumber,
              invoiceType: entry.invoiceType || 'sales',
              date: new Date(entry.date),
              hijriDate: entry.hijriDate,
              description: entry.description,
              currencyCode: entry.currencyCode || 'EGP',
              customerId: entry.customerId,
              supplierId: entry.supplierId,
              warehouseId: entry.warehouseId,
              costCenterId: entry.costCenterId,
              representativeId: entry.representativeId,
              paymentMethod: entry.paymentMethod,
              sellerId: entry.sellerId,
              lines: entry.lines || [],
            });
            imported++;
          } else if (options.entryType === 'treasury-receipt') {
            // Transform entry data to match CreateTreasuryReceiptData interface
            await treasuryReceiptService.createTreasuryReceipt(options.companyId, options.userId, {
              voucherNumber: entry.voucherNumber || entry.receiptNumber,
              date: new Date(entry.date),
              hijriDate: entry.hijriDate,
              description: entry.description,
              receiptType: entry.receiptType || 'cash',
              currencyCode: entry.currencyCode || 'EGP',
              amount: entry.amount,
              safeId: entry.safeId,
              bankAccountId: entry.bankAccountId,
              accountId: entry.accountId,
              customerId: entry.customerId,
              supplierId: entry.supplierId,
            });
            imported++;
          } else if (options.entryType === 'treasury-payment') {
            // Transform entry data to match CreateTreasuryPaymentData interface
            await treasuryPaymentService.createTreasuryPayment(options.companyId, options.userId, {
              voucherNumber: entry.voucherNumber || entry.paymentNumber,
              date: new Date(entry.date),
              hijriDate: entry.hijriDate,
              description: entry.description,
              paymentType: entry.paymentType || 'cash',
              currencyCode: entry.currencyCode || 'EGP',
              amount: entry.amount,
              safeId: entry.safeId,
              bankAccountId: entry.bankAccountId,
              accountId: entry.accountId,
              customerId: entry.customerId,
              supplierId: entry.supplierId,
            });
            imported++;
          }
        } catch (error) {
          failed++;
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          errors.push(`Entry ${imported + failed}: ${errorMessage}`);
          logger.warn({ error, entry }, 'Failed to import entry');
        }
      }

      logger.info({ imported, failed, options }, 'Entries imported');

      return { imported, failed, errors };
    } catch (error) {
      logger.error({ error, options }, 'Error importing entries');
      throw error;
    }
  }

  /**
   * Parse CSV content
   */
  private parseCSV(content: string): any[] {
    const lines = content.split('\n').filter(line => line.trim());
    if (lines.length === 0) return [];

    const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''));
    const entries = [];

    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(',').map(v => v.trim().replace(/^"|"$/g, ''));
      const entry: any = {};
      headers.forEach((header, index) => {
        entry[header] = values[index] || '';
      });
      entries.push(entry);
    }

    return entries;
  }
}

export const importEntryService = new ImportEntryService();

