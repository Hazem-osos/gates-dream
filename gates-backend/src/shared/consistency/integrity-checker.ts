import { logger } from '../logger';
import { consistencyValidator } from './validator';
import prisma from '../database/prisma';
import { partyBalanceReconciliationService } from '../../modules/accounting/services/party-balance-reconciliation.service';

/**
 * Data Integrity Checker
 * Performs scheduled data integrity checks
 */

export interface IntegrityCheckResult {
  checkName: string;
  passed: boolean;
  errors: string[];
  checkedCount: number;
  errorCount: number;
}

export class IntegrityChecker {
  /**
   * Check all journal entries for consistency
   */
  async checkJournalEntries(limit: number = 100): Promise<IntegrityCheckResult> {
    const errors: string[] = [];
    let checkedCount = 0;
    let errorCount = 0;

    try {
      const journalEntries = await prisma.journalEntry.findMany({
        take: limit,
        select: { id: true },
      });

      for (const entry of journalEntries) {
        checkedCount++;
        const result = await consistencyValidator.validateJournalEntry(entry.id);
        if (!result.valid) {
          errorCount++;
          errors.push(`Journal Entry ${entry.id}: ${result.errors.join(', ')}`);
        }
      }

      return {
        checkName: 'Journal Entries Consistency',
        passed: errorCount === 0,
        errors,
        checkedCount,
        errorCount,
      };
    } catch (error: any) {
      logger.error({ error }, 'Error checking journal entries integrity');
      return {
        checkName: 'Journal Entries Consistency',
        passed: false,
        errors: [error.message || 'Check failed'],
        checkedCount,
        errorCount,
      };
    }
  }

  /**
   * Check all invoices for consistency
   */
  async checkInvoices(limit: number = 100): Promise<IntegrityCheckResult> {
    const errors: string[] = [];
    let checkedCount = 0;
    let errorCount = 0;

    try {
      const invoices = await prisma.invoice.findMany({
        take: limit,
        select: { id: true },
      });

      for (const invoice of invoices) {
        checkedCount++;
        const result = await consistencyValidator.validateInvoice(invoice.id);
        if (!result.valid) {
          errorCount++;
          errors.push(`Invoice ${invoice.id}: ${result.errors.join(', ')}`);
        }
      }

      return {
        checkName: 'Invoices Consistency',
        passed: errorCount === 0,
        errors,
        checkedCount,
        errorCount,
      };
    } catch (error: any) {
      logger.error({ error }, 'Error checking invoices integrity');
      return {
        checkName: 'Invoices Consistency',
        passed: false,
        errors: [error.message || 'Check failed'],
        checkedCount,
        errorCount,
      };
    }
  }

  /**
   * Check employee contracts for consistency
   */
  async checkEmployeeContracts(limit: number = 100): Promise<IntegrityCheckResult> {
    const errors: string[] = [];
    let checkedCount = 0;
    let errorCount = 0;

    try {
      const contracts = await prisma.employeeContract.findMany({
        take: limit,
        select: { id: true },
      });

      for (const contract of contracts) {
        checkedCount++;
        const result = await consistencyValidator.validateEmployeeContract(contract.id);
        if (!result.valid) {
          errorCount++;
          errors.push(`Contract ${contract.id}: ${result.errors.join(', ')}`);
        }
      }

      return {
        checkName: 'Employee Contracts Consistency',
        passed: errorCount === 0,
        errors,
        checkedCount,
        errorCount,
      };
    } catch (error: any) {
      logger.error({ error }, 'Error checking employee contracts integrity');
      return {
        checkName: 'Employee Contracts Consistency',
        passed: false,
        errors: [error.message || 'Check failed'],
        checkedCount,
        errorCount,
      };
    }
  }

  async checkPartyBalanceDrift(): Promise<IntegrityCheckResult> {
    const errors: string[] = [];
    let checkedCount = 0;
    let errorCount = 0;

    try {
      const companies = await prisma.company.findMany({
        where: { isActive: true, deletedAt: null },
        select: { id: true, arabicName: true },
      });

      for (const company of companies) {
        const recon = await partyBalanceReconciliationService.detectAnomalies(company.id);
        checkedCount += recon.checkedCount;
        if (!recon.requiresReconciliation) continue;

        const material = recon.mismatched.filter((row) => Math.abs(row.variance) > 1);
        errorCount += material.length;
        errors.push(
          `${company.arabicName ?? company.id}: ${material.length} party balance(s) drift > 1.00 ${recon.baseCurrency}`
        );

        await prisma.systemNotification.create({
          data: {
            companyId: company.id,
            title: 'انحراف أرصدة العملاء/الموردين عن الأستاذ العام',
            message: `تم رصد ${material.length} طرفاً بفرق أكبر من 1.00 ${recon.baseCurrency}. الإجمالي: ${recon.totalVariance.toFixed(2)}. يتطلب مطابقة.`,
            type: 'WARNING',
            category: 'FINANCIAL_LIQUIDITY',
            linkUrl: '/accounting/reconcile',
          },
        });
      }

      return {
        checkName: 'Party Balance Base-Currency Drift',
        passed: errorCount === 0,
        errors,
        checkedCount,
        errorCount,
      };
    } catch (error: any) {
      logger.error({ error }, 'Error checking party balance drift');
      return {
        checkName: 'Party Balance Base-Currency Drift',
        passed: false,
        errors: [error.message || 'Check failed'],
        checkedCount,
        errorCount,
      };
    }
  }

  /**
   * Run all integrity checks
   */
  async runAllChecks(): Promise<IntegrityCheckResult[]> {
    logger.info('Starting data integrity checks');

    const results = await Promise.all([
      this.checkJournalEntries(100),
      this.checkInvoices(100),
      this.checkEmployeeContracts(100),
      this.checkPartyBalanceDrift(),
    ]);

    const totalErrors = results.reduce((sum, r) => sum + r.errorCount, 0);
    const totalChecked = results.reduce((sum, r) => sum + r.checkedCount, 0);

    logger.info(
      {
        totalChecked,
        totalErrors,
        results: results.map((r) => ({
          check: r.checkName,
          passed: r.passed,
          errors: r.errorCount,
        })),
      },
      'Data integrity checks completed'
    );

    return results;
  }
}

export const integrityChecker = new IntegrityChecker();
