import { logger } from '../logger';
import prisma from '../database/prisma';

/**
 * Data Consistency Validator
 * Validates business rules and data consistency
 */

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

export class ConsistencyValidator {
  /**
   * Validate journal entry consistency
   */
  async validateJournalEntry(journalEntryId: string): Promise<ValidationResult> {
    const errors: string[] = [];

    try {
      const journalEntry = await prisma.journalEntry.findUnique({
        where: { id: journalEntryId },
        include: {
          lines: true,
        },
      });

      if (!journalEntry) {
        return {
          valid: false,
          errors: ['Journal entry not found'],
        };
      }

      // Check debit/credit balance
      const totalDebit = journalEntry.lines.reduce((sum, line) => sum + Number(line.debit), 0);
      const totalCredit = journalEntry.lines.reduce((sum, line) => sum + Number(line.credit), 0);

      if (Math.abs(totalDebit - totalCredit) > 0.01) {
        errors.push(`Debit/Credit imbalance: Debit=${totalDebit}, Credit=${totalCredit}`);
      }

      // Check all lines have accounts
      const linesWithoutAccounts = journalEntry.lines.filter((line) => !line.accountId);
      if (linesWithoutAccounts.length > 0) {
        errors.push(`Found ${linesWithoutAccounts.length} lines without accounts`);
      }

      // Check all accounts belong to same company
      const accountIds = journalEntry.lines.map((line) => line.accountId).filter(Boolean);
      if (accountIds.length > 0) {
        const accounts = await prisma.account.findMany({
          where: {
            id: { in: accountIds },
          },
          select: { companyId: true },
        });

        const companyIds = new Set(accounts.map((a) => a.companyId));
        if (companyIds.size > 1) {
          errors.push('Journal entry lines reference accounts from different companies');
        }

        if (!companyIds.has(journalEntry.companyId)) {
          errors.push('Journal entry company does not match account companies');
        }
      }

      return {
        valid: errors.length === 0,
        errors,
      };
    } catch (error: any) {
      logger.error({ error, journalEntryId }, 'Error validating journal entry');
      return {
        valid: false,
        errors: [error.message || 'Validation error'],
      };
    }
  }

  /**
   * Validate invoice consistency
   */
  async validateInvoice(invoiceId: string): Promise<ValidationResult> {
    const errors: string[] = [];

    try {
      const invoice = await prisma.invoice.findUnique({
        where: { id: invoiceId },
        include: {
          lines: {
            include: {
              item: true,
            },
          },
        },
      });

      if (!invoice) {
        return {
          valid: false,
          errors: ['Invoice not found'],
        };
      }

      // Check total matches sum of lines
      const lineTotal = invoice.lines.reduce(
        (sum, line) => sum + Number(line.total),
        0
      );
      const difference = Math.abs(Number(invoice.totalAmount) - lineTotal);

      if (difference > 0.01) {
        errors.push(`Total mismatch: Invoice total=${invoice.totalAmount}, Line total=${lineTotal}`);
      }

      // Check all items belong to same company
      const itemIds = invoice.lines.map((line) => line.itemId).filter(Boolean);
      if (itemIds.length > 0) {
        const items = await prisma.item.findMany({
          where: {
            id: { in: itemIds },
          },
          select: { companyId: true },
        });

        const companyIds = new Set(items.map((i) => i.companyId));
        if (companyIds.size > 1) {
          errors.push('Invoice lines reference items from different companies');
        }

        if (!companyIds.has(invoice.companyId)) {
          errors.push('Invoice company does not match item companies');
        }
      }

      return {
        valid: errors.length === 0,
        errors,
      };
    } catch (error: any) {
      logger.error({ error, invoiceId }, 'Error validating invoice');
      return {
        valid: false,
        errors: [error.message || 'Validation error'],
      };
    }
  }

  /**
   * Validate employee contract consistency
   */
  async validateEmployeeContract(contractId: string): Promise<ValidationResult> {
    const errors: string[] = [];

    try {
      const contract = await prisma.employeeContract.findUnique({
        where: { id: contractId },
        include: {
          employee: true,
        },
      });

      if (!contract) {
        return {
          valid: false,
          errors: ['Contract not found'],
        };
      }

      // Check date ranges
      if (contract.contractStartDate && contract.contractEndDate) {
        if (contract.contractStartDate > contract.contractEndDate) {
          errors.push('Contract start date is after end date');
        }
      }

      return {
        valid: errors.length === 0,
        errors,
      };
    } catch (error: any) {
      logger.error({ error, contractId }, 'Error validating employee contract');
      return {
        valid: false,
        errors: [error.message || 'Validation error'],
      };
    }
  }
}

export const consistencyValidator = new ConsistencyValidator();
