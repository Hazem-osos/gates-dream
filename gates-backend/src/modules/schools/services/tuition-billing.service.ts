import { Decimal } from '@prisma/client/runtime/library';
import prisma from '../../../shared/database/prisma';
import { AppError } from '../../../shared/middleware/error-handler';
import { roundTo4 } from '../../../shared/utils/decimal-round';
import {
  journalPostingService,
  type JournalPostingContext,
} from '../../accounting/services/journal-posting.service';
import { documentSequenceService } from '../../platform/services/document-sequence.service';
import { journalLines } from '../../trade/utils/journal-lines.util';
import { cashTransactionService } from '../../treasury/services/cash-transaction.service';
import { treasuryPostingService } from '../../treasury/services/treasury-posting.service';
import type { TreasuryPostingContext } from '../../treasury/types/treasury.types';
import { schoolAccountResolverService } from './school-account-resolver.service';
import { studentEnrollmentService } from './student-enrollment.service';

function splitInstallments(
  totalNet: number,
  terms: Array<{ termName: string; dueDate: Date }>
) {
  const count = terms.length;
  const base = roundTo4(totalNet / count);
  let allocated = 0;
  return terms.map((t, idx) => {
    const isLast = idx === count - 1;
    const amount = isLast ? roundTo4(totalNet - allocated) : base;
    allocated = roundTo4(allocated + amount);
    return {
      installmentNumber: idx + 1,
      termName: t.termName,
      dueDate: t.dueDate,
      amount,
    };
  });
}

export class TuitionBillingService {
  private async allocateGlNum(ctx: JournalPostingContext): Promise<string | undefined> {
    return documentSequenceService.nextGlNumber(ctx);
  }

  async createFeeContract(
    companyId: string,
    input: {
      studentId: string;
      contractNumber: string;
      tuitionFee?: number;
      booksFee?: number;
      busFee?: number;
      totalDiscount?: number;
      termDueDates?: Array<{ termName: string; dueDate: Date }>;
    }
  ) {
    const student = await studentEnrollmentService.getStudent(companyId, input.studentId);
    const tuition = roundTo4(input.tuitionFee ?? Number(student.grade.defaultTuitionFee));
    const books = roundTo4(input.booksFee ?? 0);
    const bus = roundTo4(
      input.busFee ?? (student.busRoute ? Number(student.busRoute.annualFee) : 0)
    );
    const discount = roundTo4(input.totalDiscount ?? 0);
    const gross = roundTo4(tuition + books + bus);
    const net = roundTo4(gross - discount);
    const unearnedTuition = roundTo4(tuition - discount);

    const terms =
      input.termDueDates ??
      student.academicYear.terms.map((t) => ({
        termName: t.termName,
        dueDate: t.startDate ?? new Date(),
      }));
    if (terms.length === 0) {
      throw new AppError(422, 'Define academic terms or provide termDueDates');
    }

    const schedule = splitInstallments(net, terms);

    return prisma.$transaction(async (tx) => {
      const contract = await tx.studentFeeContract.create({
        data: {
          companyId,
          studentId: student.id,
          academicYearId: student.academicYearId,
          contractNumber: input.contractNumber,
          totalGrossFee: new Decimal(gross),
          totalDiscount: new Decimal(discount),
          totalNetFee: new Decimal(net),
          tuitionFee: new Decimal(tuition),
          busFee: new Decimal(bus),
          booksFee: new Decimal(books),
          status: 'ACTIVE',
          unearnedTuitionBalance: new Decimal(Math.max(0, unearnedTuition)),
        },
      });

      for (const row of schedule) {
        await tx.studentFeeInstallment.create({
          data: {
            contractId: contract.id,
            installmentNumber: row.installmentNumber,
            termName: row.termName,
            dueDate: row.dueDate,
            amount: new Decimal(row.amount),
            status: 'PENDING',
          },
        });
      }

      return tx.studentFeeContract.findUnique({
        where: { id: contract.id },
        include: {
          installments: { orderBy: { installmentNumber: 'asc' } },
          student: { include: { grade: true, guardian: true } },
        },
      });
    });
  }

  async getContract(companyId: string, contractId: string) {
    const row = await prisma.studentFeeContract.findFirst({
      where: { id: contractId, companyId },
      include: {
        installments: { orderBy: { installmentNumber: 'asc' } },
        student: { include: { grade: true, guardian: true } },
      },
    });
    if (!row) throw new AppError(404, 'Fee contract not found');
    return row;
  }

  async postFeeAccrual(ctx: JournalPostingContext, contractId: string) {
    const contract = await this.getContract(ctx.companyId, contractId);
    if (contract.accrualJournalEntryId) {
      throw new AppError(400, 'Fee accrual already posted');
    }

    const accounts = await schoolAccountResolverService.resolveAccounts(ctx.companyId);
    const net = roundTo4(Number(contract.totalNetFee));
    const discount = roundTo4(Number(contract.totalDiscount));
    const tuitionNet = roundTo4(Number(contract.tuitionFee) - discount);
    const bus = roundTo4(Number(contract.busFee));
    const books = roundTo4(Number(contract.booksFee));
    const tuitionGross = roundTo4(Number(contract.tuitionFee));

    const legacyGlNum = await this.allocateGlNum(ctx);

    return prisma.$transaction(async (tx) => {
      const je = await journalPostingService.createAndPostInTx(tx, ctx, {
        fiscalYearId: ctx.fiscalYearId!,
        legacyGlNum,
        date: new Date(),
        description: `School fee accrual ${contract.contractNumber}`,
        currencyCode: 'EGP',
        exchangeRate: 1,
        entryType: 'StudentFeeAccrual',
        sourceType: 'SFA',
        sourceNumber: contract.contractNumber,
        lines: journalLines([
          { accountId: accounts.studentArAccountId, debit: net, credit: 0 },
          { accountId: accounts.tuitionDiscountAccountId, debit: discount, credit: 0 },
          {
            accountId: accounts.unearnedTuitionRevenueAccountId,
            debit: 0,
            credit: tuitionGross,
          },
          { accountId: accounts.busRevenueAccountId, debit: 0, credit: bus },
          { accountId: accounts.booksRevenueAccountId, debit: 0, credit: books },
        ]),
      });

      return tx.studentFeeContract.update({
        where: { id: contractId },
        data: {
          accrualJournalEntryId: je.id,
          postedAt: new Date(),
          outstandingArBalance: new Decimal(net),
          unearnedTuitionBalance: new Decimal(tuitionNet),
        },
        include: { installments: true },
      });
    });
  }

  /**
   * Wave 2 fix: reverses the fee-accrual AR/unearned-revenue posting.
   * Blocked once any installment has been collected or revenue has been
   * recognized against it.
   */
  async unpostFeeAccrual(ctx: JournalPostingContext, contractId: string) {
    const contract = await this.getContract(ctx.companyId, contractId);
    if (!contract.accrualJournalEntryId) {
      throw new AppError(400, 'Contract has no fee accrual journal entry to reverse');
    }
    if (contract.recognitionJournalEntryId) {
      throw new AppError(400, 'Unpost revenue recognition before unposting the fee accrual');
    }
    const anyPaid = contract.installments.some((i) => i.status === 'PAID');
    if (anyPaid) {
      throw new AppError(
        400,
        'Cannot unpost fee accrual while installments have been collected against it'
      );
    }

    return prisma.$transaction(async (tx) => {
      await journalPostingService.reverseJournalEntryInTx(tx, ctx, contract.accrualJournalEntryId!, {
        reason: 'School fee accrual unposted',
      });

      return tx.studentFeeContract.update({
        where: { id: contractId },
        data: {
          accrualJournalEntryId: null,
          postedAt: null,
          outstandingArBalance: new Decimal(0),
          unearnedTuitionBalance: new Decimal(0),
        },
        include: { installments: true },
      });
    });
  }

  async collectInstallment(
    ctx: JournalPostingContext,
    treasuryCtx: TreasuryPostingContext,
    installmentId: string,
    input: { safeId?: string; bankAccountId?: string; voucherNumber?: string }
  ) {
    const installment = await prisma.studentFeeInstallment.findFirst({
      where: { id: installmentId, contract: { companyId: ctx.companyId } },
      include: { contract: { include: { student: true } } },
    });
    if (!installment) throw new AppError(404, 'Installment not found');
    if (installment.status === 'PAID') throw new AppError(400, 'Installment already paid');

    const accounts = await schoolAccountResolverService.resolveAccounts(ctx.companyId);
    const amount = roundTo4(Number(installment.amount));

    const cashTx = await cashTransactionService.create(
      ctx.companyId,
      ctx.branchId,
      ctx.fiscalYearId,
      {
        transactionKind: 'RECEIPT',
        voucherNumber: input.voucherNumber,
        date: new Date(),
        amount,
        currencyCode: 'EGP',
        customerId: installment.contract.student.guardianCustomerId,
        offsetAccountId: accounts.studentArAccountId,
        safeId: input.safeId,
        bankAccountId: input.bankAccountId,
        description: `School fee ${installment.termName ?? installment.installmentNumber}`,
      }
    );

    const posted = await treasuryPostingService.postCashTransaction(treasuryCtx, cashTx.id);
    const newOutstanding = roundTo4(
      Number(installment.contract.outstandingArBalance) - amount
    );

    return prisma.$transaction(async (tx) => {
      await tx.studentFeeInstallment.update({
        where: { id: installmentId },
        data: {
          status: 'PAID',
          paidAt: new Date(),
          paymentTransactionId: posted!.id,
        },
      });
      return tx.studentFeeContract.update({
        where: { id: installment.contractId },
        data: { outstandingArBalance: new Decimal(Math.max(0, newOutstanding)) },
        include: { installments: { orderBy: { installmentNumber: 'asc' } } },
      });
    });
  }

  async recognizeTermRevenue(
    ctx: JournalPostingContext,
    contractId: string,
    input: { amount?: number; recognitionDate?: Date }
  ) {
    const contract = await this.getContract(ctx.companyId, contractId);
    if (!contract.accrualJournalEntryId) {
      throw new AppError(422, 'Post fee accrual before revenue recognition');
    }

    const unearned = roundTo4(Number(contract.unearnedTuitionBalance));
    const recognize = roundTo4(input.amount ?? unearned);
    if (recognize <= 0 || recognize > unearned) {
      throw new AppError(422, 'Invalid recognition amount');
    }

    const accounts = await schoolAccountResolverService.resolveAccounts(ctx.companyId);
    const ccId = contract.student.grade.costCenterId ?? undefined;
    const legacyGlNum = await this.allocateGlNum(ctx);

    const revenueLine: {
      accountId: string;
      debit: number;
      credit: number;
      costCenterId?: string;
    } = {
      accountId: accounts.earnedTuitionRevenueAccountId,
      debit: 0,
      credit: recognize,
    };
    if (ccId) revenueLine.costCenterId = ccId;

    return prisma.$transaction(async (tx) => {
      const je = await journalPostingService.createAndPostInTx(tx, ctx, {
        fiscalYearId: ctx.fiscalYearId!,
        legacyGlNum,
        date: input.recognitionDate ?? new Date(),
        description: `Tuition revenue recognition ${contract.contractNumber}`,
        currencyCode: 'EGP',
        exchangeRate: 1,
        entryType: 'TuitionRecognition',
        sourceType: 'TR',
        sourceNumber: contract.contractNumber,
        lines: journalLines([
          {
            accountId: accounts.unearnedTuitionRevenueAccountId,
            debit: recognize,
            credit: 0,
          },
          revenueLine,
        ]),
      });

      return tx.studentFeeContract.update({
        where: { id: contractId },
        data: {
          recognitionJournalEntryId: je.id,
          unearnedTuitionBalance: new Decimal(roundTo4(unearned - recognize)),
        },
        include: { installments: true },
      });
    });
  }

  /**
   * Wave 2 fix: reverses the most recent term-revenue recognition, restoring
   * the recognized amount back to the unearned balance. Only one recognition
   * JE id is tracked on the contract, so this always unwinds the latest one.
   */
  async unpostTermRevenueRecognition(ctx: JournalPostingContext, contractId: string) {
    const contract = await this.getContract(ctx.companyId, contractId);
    if (!contract.recognitionJournalEntryId) {
      throw new AppError(400, 'Contract has no revenue recognition journal entry to reverse');
    }

    return prisma.$transaction(async (tx) => {
      const originalJe = await tx.journalEntry.findFirst({
        where: { id: contract.recognitionJournalEntryId!, companyId: ctx.companyId },
        include: { lines: true },
      });
      const recognized = roundTo4(
        originalJe?.lines
          .filter((l) => Number(l.debit) > 0)
          .reduce((s, l) => s + Number(l.debit), 0) ?? 0
      );

      await journalPostingService.reverseJournalEntryInTx(
        tx,
        ctx,
        contract.recognitionJournalEntryId!,
        { reason: 'Tuition revenue recognition unposted' }
      );

      return tx.studentFeeContract.update({
        where: { id: contractId },
        data: {
          recognitionJournalEntryId: null,
          unearnedTuitionBalance: new Decimal(
            roundTo4(Number(contract.unearnedTuitionBalance) + recognized)
          ),
        },
        include: { installments: true },
      });
    });
  }
}

export const tuitionBillingService = new TuitionBillingService();
