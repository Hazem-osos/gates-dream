import { Prisma } from '@prisma/client';
import prisma from '../../../shared/database/prisma';
import { AppError } from '../../../shared/middleware/error-handler';
import { roundTo4 } from '../../../shared/utils/decimal-round';
import {
  journalPostingService,
  type JournalPostingContext,
} from '../../accounting/services/journal-posting.service';
import { documentSequenceService } from '../../platform/services/document-sequence.service';
import { treasuryAccountResolverService } from '../../treasury/services/treasury-account-resolver.service';
import { hrGlAccountResolverService } from './hr-gl-account-resolver.service';
import { payrollEngineService } from './payroll-engine.service';
import { journalLines } from '../../trade/utils/journal-lines.util';

export class PayrollPostingService {
  private async allocateGlNum(ctx: JournalPostingContext): Promise<string | undefined> {
    return documentSequenceService.nextGlNumber(ctx);
  }

  private async applyAdvanceRecoveries(tx: Prisma.TransactionClient, runId: string) {
    const items = await tx.payrollRunItem.findMany({ where: { payrollRunId: runId } });
    for (const item of items) {
      let toRecover = Number(item.advanceDeduction);
      if (toRecover <= 0) continue;

      const advances = await tx.employeeAdvance.findMany({
        where: {
          employeeId: item.employeeId,
          isActive: true,
          isSettled: false,
        },
        orderBy: { date: 'asc' },
      });

      for (const adv of advances) {
        if (toRecover <= 0) break;
        const remaining = Number(adv.remainingAmount ?? adv.value);
        if (remaining <= 0) continue;
        const take = Math.min(toRecover, remaining);
        const nextRemaining = roundTo4(remaining - take);
        await tx.employeeAdvance.update({
          where: { id: adv.id },
          data: {
            remainingAmount: nextRemaining,
            isSettled: nextRemaining <= 0,
          },
        });
        toRecover = roundTo4(toRecover - take);
      }
    }
  }

  /**
   * Best-effort reversal of applyAdvanceRecoveries: restores the recovered
   * amount to the employee's advances, most-recently-touched first (the
   * reverse of the FIFO consumption order), re-opening any that were closed
   * out by this run's recovery.
   */
  private async reverseAdvanceRecoveries(tx: Prisma.TransactionClient, runId: string) {
    const items = await tx.payrollRunItem.findMany({ where: { payrollRunId: runId } });
    for (const item of items) {
      let toRestore = Number(item.advanceDeduction);
      if (toRestore <= 0) continue;

      const advances = await tx.employeeAdvance.findMany({
        where: { employeeId: item.employeeId, isActive: true },
        orderBy: { date: 'desc' },
      });

      for (const adv of advances) {
        if (toRestore <= 0) break;
        const original = Number(adv.value);
        const remaining = Number(adv.remainingAmount ?? adv.value);
        const room = roundTo4(original - remaining);
        if (room <= 0) continue;
        const give = Math.min(toRestore, room);
        const nextRemaining = roundTo4(remaining + give);
        await tx.employeeAdvance.update({
          where: { id: adv.id },
          data: { remainingAmount: nextRemaining, isSettled: nextRemaining <= 0 },
        });
        toRestore = roundTo4(toRestore - give);
      }
    }
  }

  async postAccrual(ctx: JournalPostingContext, payrollRunId: string) {
    const run = await payrollEngineService.getPayrollRun(ctx.companyId, payrollRunId);
    if (run.status !== 'DRAFT') {
      throw new AppError(400, 'Payroll run is not in DRAFT status');
    }

    const accounts = await hrGlAccountResolverService.resolveAccounts(ctx.companyId);
    const gross = roundTo4(Number(run.totalGross));
    const employerIns = roundTo4(Number(run.totalEmployerInsurance));
    const employeeIns = roundTo4(Number(run.totalEmployeeInsurance));
    const tax = roundTo4(Number(run.totalTax));
    const advances = roundTo4(Number(run.totalAdvanceDeduction));
    const net = roundTo4(Number(run.totalNet));

    const socialPayable = roundTo4(employeeIns + employerIns);
    const legacyGlNum = await this.allocateGlNum(ctx);
    const runLabel = `${run.periodYear}-${String(run.periodMonth).padStart(2, '0')}`;

    return prisma.$transaction(async (tx) => {
      const je = await journalPostingService.createAndPostInTx(tx, ctx, {
        fiscalYearId: ctx.fiscalYearId!,
        legacyGlNum,
        date: new Date(),
        description: `Payroll accrual ${runLabel}`,
        currencyCode: 'EGP',
        exchangeRate: 1,
        entryType: 'PayrollAccrual',
        sourceType: 'PR',
        sourceNumber: runLabel,
        sourceYearId: String(run.periodYear),
        lines: journalLines([
          { accountId: accounts.salariesExpenseAccountId, debit: gross, credit: 0 },
          {
            accountId: accounts.employerInsuranceExpenseAccountId,
            debit: employerIns,
            credit: 0,
          },
          {
            accountId: accounts.socialInsurancePayableAccountId,
            debit: 0,
            credit: socialPayable,
          },
          { accountId: accounts.payrollTaxPayableAccountId, debit: 0, credit: tax },
          { accountId: accounts.employeeAdvancesAccountId, debit: 0, credit: advances },
          { accountId: accounts.accruedPayrollAccountId, debit: 0, credit: net },
        ]),
      });

      await this.applyAdvanceRecoveries(tx, payrollRunId);

      return tx.payrollRun.update({
        where: { id: payrollRunId },
        data: {
          status: 'POSTED',
          accrualJournalEntryId: je.id,
          postedAt: new Date(),
        },
        include: { items: true },
      });
    });
  }

  /**
   * Wave 2 fix: reverses a POSTED (not yet disbursed) accrual — dated contra
   * entry against the accrual JE, restores advance balances, and returns the
   * run to DRAFT so it can be corrected and re-posted.
   */
  async unpostAccrual(ctx: JournalPostingContext, payrollRunId: string) {
    const run = await payrollEngineService.getPayrollRun(ctx.companyId, payrollRunId);
    if (run.status !== 'POSTED') {
      throw new AppError(400, 'Only a POSTED (not yet disbursed) payroll run can be unposted');
    }
    if (!run.accrualJournalEntryId) {
      throw new AppError(400, 'Payroll run has no accrual journal entry to reverse');
    }

    return prisma.$transaction(async (tx) => {
      await journalPostingService.reverseJournalEntryInTx(tx, ctx, run.accrualJournalEntryId!, {
        reason: 'Payroll accrual unposted',
      });

      await this.reverseAdvanceRecoveries(tx, payrollRunId);

      return tx.payrollRun.update({
        where: { id: payrollRunId },
        data: {
          status: 'DRAFT',
          accrualJournalEntryId: null,
          postedAt: null,
        },
        include: { items: true },
      });
    });
  }

  async disbursePayroll(
    ctx: JournalPostingContext,
    payrollRunId: string,
    payment: { safeId?: string; bankAccountId?: string }
  ) {
    const run = await payrollEngineService.getPayrollRun(ctx.companyId, payrollRunId);
    if (run.status !== 'POSTED') {
      throw new AppError(400, 'Payroll must be POSTED before disbursement');
    }
    if (run.paymentJournalEntryId) {
      throw new AppError(400, 'Payroll run is already disbursed');
    }
    if (!payment.safeId && !payment.bankAccountId) {
      throw new AppError(422, 'safeId or bankAccountId is required');
    }

    const accounts = await hrGlAccountResolverService.resolveAccounts(ctx.companyId);
    const net = roundTo4(Number(run.totalNet));
    let cashGlId: string;
    if (payment.safeId) {
      cashGlId = await treasuryAccountResolverService.resolveSafeGlAccountId(
        ctx.companyId,
        payment.safeId
      );
    } else {
      cashGlId = await treasuryAccountResolverService.resolveBankGlAccountId(
        ctx.companyId,
        payment.bankAccountId!
      );
    }

    const legacyGlNum = await this.allocateGlNum(ctx);
    const runLabel = `${run.periodYear}-${String(run.periodMonth).padStart(2, '0')}`;

    return prisma.$transaction(async (tx) => {
      const je = await journalPostingService.createAndPostInTx(tx, ctx, {
        fiscalYearId: ctx.fiscalYearId!,
        legacyGlNum,
        date: new Date(),
        description: `Payroll disbursement ${runLabel}`,
        currencyCode: 'EGP',
        exchangeRate: 1,
        entryType: 'PayrollPay',
        sourceType: 'PR',
        sourceNumber: `${runLabel}-PAY`,
        sourceYearId: String(run.periodYear),
        lines: journalLines([
          { accountId: accounts.accruedPayrollAccountId, debit: net, credit: 0 },
          { accountId: cashGlId, debit: 0, credit: net },
        ]),
      });

      return tx.payrollRun.update({
        where: { id: payrollRunId },
        data: {
          status: 'PAID',
          paymentJournalEntryId: je.id,
          paymentSafeId: payment.safeId,
          paymentBankAccountId: payment.bankAccountId,
          paidAt: new Date(),
        },
        include: { items: true },
      });
    });
  }

  /**
   * Wave 2 fix: reverses a PAID disbursement — dated contra entry against the
   * payment JE, returns the run to POSTED so accrual still stands but the
   * cash movement can be corrected and redone.
   */
  async unpostDisbursement(ctx: JournalPostingContext, payrollRunId: string) {
    const run = await payrollEngineService.getPayrollRun(ctx.companyId, payrollRunId);
    if (run.status !== 'PAID') {
      throw new AppError(400, 'Only a PAID payroll run can have its disbursement unposted');
    }
    if (!run.paymentJournalEntryId) {
      throw new AppError(400, 'Payroll run has no payment journal entry to reverse');
    }

    return prisma.$transaction(async (tx) => {
      await journalPostingService.reverseJournalEntryInTx(tx, ctx, run.paymentJournalEntryId!, {
        reason: 'Payroll disbursement unposted',
      });

      return tx.payrollRun.update({
        where: { id: payrollRunId },
        data: {
          status: 'POSTED',
          paymentJournalEntryId: null,
          paymentSafeId: null,
          paymentBankAccountId: null,
          paidAt: null,
        },
        include: { items: true },
      });
    });
  }
}

export const payrollPostingService = new PayrollPostingService();
