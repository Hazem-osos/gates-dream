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
import {
  installmentScheduleService,
  type InstallmentFrequency,
} from './installment-schedule.service';
import { realEstateAccountResolverService } from './real-estate-account-resolver.service';
import { realEstateUnitService } from './real-estate-unit.service';

export class UnitContractService {
  private async allocateGlNum(ctx: JournalPostingContext): Promise<string | undefined> {
    return documentSequenceService.nextGlNumber(ctx);
  }

  async createWithSchedule(
    companyId: string,
    input: {
      unitId: string;
      customerId: string;
      contractNumber: string;
      contractDate: Date;
      deliveryDate?: Date;
      totalContractAmount?: number;
      downPayment: number;
      maintenanceAmount?: number;
      discountAmount?: number;
      financingInterest?: number;
      frequency: InstallmentFrequency;
      installmentCount: number;
      balloonOnDelivery?: number;
    }
  ) {
    const unit = await realEstateUnitService.getUnit(companyId, input.unitId);
    if (unit.status !== 'AVAILABLE' && unit.status !== 'RESERVED') {
      throw new AppError(422, 'Unit is not available for sale contract');
    }

    const totalContractAmount = roundTo4(
      input.totalContractAmount ?? Number(unit.totalPrice) - (input.discountAmount ?? 0)
    );
    const maintenanceAmount = roundTo4(
      input.maintenanceAmount ?? Number(unit.maintenanceDeposit)
    );

    const schedule = installmentScheduleService.generate({
      contractDate: input.contractDate,
      deliveryDate: input.deliveryDate,
      totalContractAmount,
      downPayment: input.downPayment,
      financingInterest: input.financingInterest,
      frequency: input.frequency,
      installmentCount: input.installmentCount,
      balloonOnDelivery: input.balloonOnDelivery,
    });

    return prisma.$transaction(async (tx) => {
      const contract = await tx.unitContract.create({
        data: {
          companyId,
          unitId: unit.id,
          customerId: input.customerId,
          contractNumber: input.contractNumber,
          contractDate: input.contractDate,
          deliveryDate: input.deliveryDate,
          totalContractAmount: new Decimal(totalContractAmount),
          totalSellingPrice: new Decimal(totalContractAmount),
          downPayment: new Decimal(input.downPayment),
          maintenanceAmount: new Decimal(maintenanceAmount),
          maintenanceDeposit: new Decimal(maintenanceAmount),
          discountAmount: new Decimal(input.discountAmount ?? 0),
          financingInterest: new Decimal(input.financingInterest ?? 0),
          status: 'ACTIVE',
        },
      });

      for (const row of schedule) {
        await tx.unitInstallment.create({
          data: {
            contractId: contract.id,
            installmentNumber: row.installmentNumber,
            dueDate: row.dueDate,
            amount: new Decimal(row.amount),
            originalAmount: new Decimal(row.amount),
            paidAmount: new Decimal(0),
            balance: new Decimal(row.amount),
            interestPortion: new Decimal(row.interestPortion),
            status: 'PENDING',
          },
        });
      }

      await tx.realEstateUnit.update({
        where: { id: unit.id },
        data: { status: 'SOLD' },
      });

      return tx.unitContract.findUnique({
        where: { id: contract.id },
        include: { installments: { orderBy: { installmentNumber: 'asc' } } },
      });
    });
  }

  async list(
    companyId: string,
    filters: { status?: string; customerId?: string; limit?: number } = {}
  ) {
    return prisma.unitContract.findMany({
      where: {
        companyId,
        ...(filters.status ? { status: filters.status } : {}),
        ...(filters.customerId ? { customerId: filters.customerId } : {}),
      },
      include: {
        unit: { select: { id: true, unitCode: true, status: true } },
        customer: { select: { id: true, arabicName: true, code: true } },
        _count: { select: { installments: true } },
      },
      orderBy: { contractDate: 'desc' },
      take: Math.min(filters.limit ?? 100, 500),
    });
  }

  async getById(companyId: string, contractId: string) {
    const row = await prisma.unitContract.findFirst({
      where: { id: contractId, companyId },
      include: {
        installments: { orderBy: { installmentNumber: 'asc' } },
        unit: { include: { building: { include: { project: true } } } },
        propertyUnit: { include: { phase: { include: { project: true } } } },
        customer: true,
        postDatedCheques: { orderBy: { chequeDate: 'asc' } },
        resaleTransfers: {
          include: {
            newBuyer: { select: { id: true, arabicName: true, code: true } },
            seller: { select: { id: true, arabicName: true, code: true } },
          },
          orderBy: { createdAt: 'desc' },
        },
        cancellationSettlements: { orderBy: { createdAt: 'desc' } },
      },
    });
    if (!row) throw new AppError(404, 'Unit contract not found');
    return row;
  }

  async postContractExecution(ctx: JournalPostingContext, contractId: string) {
    const contract = await this.getById(ctx.companyId, contractId);
    if (contract.contractJournalEntryId) {
      throw new AppError(400, 'Contract already posted to GL');
    }

    const accounts = await realEstateAccountResolverService.resolveAccounts(ctx.companyId);
    const contractTotal = roundTo4(Number(contract.totalContractAmount));
    const maintenance = roundTo4(Number(contract.maintenanceAmount));
    const arTotal = roundTo4(contractTotal + maintenance);

    const legacyGlNum = await this.allocateGlNum(ctx);

    return prisma.$transaction(async (tx) => {
      const je = await journalPostingService.createAndPostInTx(tx, ctx, {
        fiscalYearId: ctx.fiscalYearId!,
        legacyGlNum,
        date: contract.contractDate,
        description: `Real estate contract ${contract.contractNumber}`,
        currencyCode: 'EGP',
        exchangeRate: 1,
        entryType: 'UnitContract',
        sourceType: 'UC',
        sourceNumber: contract.contractNumber,
        lines: journalLines([
          { accountId: accounts.realEstateArAccountId, debit: contractTotal, credit: 0 },
          {
            accountId: accounts.unearnedRealEstateRevenueAccountId,
            debit: 0,
            credit: contractTotal,
          },
          { accountId: accounts.realEstateArAccountId, debit: maintenance, credit: 0 },
          {
            accountId: accounts.maintenanceDepositsAccountId,
            debit: 0,
            credit: maintenance,
          },
        ]),
      });

      return tx.unitContract.update({
        where: { id: contractId },
        data: {
          contractJournalEntryId: je.id,
          postedAt: new Date(),
          outstandingArBalance: new Decimal(arTotal),
          unearnedRevenueBalance: new Decimal(contractTotal),
        },
        include: { installments: true },
      });
    });
  }

  /**
   * Wave 2 fix: reverses the contract-execution AR/unearned-revenue posting.
   * Blocked once any installment has been collected or the unit has been
   * handed over, since both build on the AR/unearned balances this creates.
   */
  async unpostContractExecution(ctx: JournalPostingContext, contractId: string) {
    const contract = await this.getById(ctx.companyId, contractId);
    if (!contract.contractJournalEntryId) {
      throw new AppError(400, 'Contract has no execution journal entry to reverse');
    }
    if (contract.handoverJournalEntryId) {
      throw new AppError(400, 'Unpost the handover before unposting contract execution');
    }
    const anyPaid = contract.installments.some((i) => i.status === 'PAID');
    if (anyPaid) {
      throw new AppError(
        400,
        'Cannot unpost contract execution while installments have been collected against it'
      );
    }

    return prisma.$transaction(async (tx) => {
      await journalPostingService.reverseJournalEntryInTx(tx, ctx, contract.contractJournalEntryId!, {
        reason: 'Real estate contract execution unposted',
      });

      return tx.unitContract.update({
        where: { id: contractId },
        data: {
          contractJournalEntryId: null,
          postedAt: null,
          outstandingArBalance: new Decimal(0),
          unearnedRevenueBalance: new Decimal(0),
        },
        include: { installments: true },
      });
    });
  }

  async collectInstallment(
    ctx: JournalPostingContext,
    treasuryCtx: TreasuryPostingContext,
    installmentId: string,
    input: {
      safeId?: string;
      bankAccountId?: string;
      collectionDate?: Date;
      voucherNumber?: string;
    }
  ) {
    const installment = await prisma.unitInstallment.findFirst({
      where: { id: installmentId, contract: { companyId: ctx.companyId } },
      include: { contract: true },
    });
    if (!installment) throw new AppError(404, 'Installment not found');
    if (installment.status === 'PAID') {
      throw new AppError(400, 'Installment already paid');
    }
    if (installment.contract.status !== 'ACTIVE') {
      throw new AppError(422, `Cannot collect against a ${installment.contract.status} contract`);
    }

    const accounts = await realEstateAccountResolverService.resolveAccounts(ctx.companyId);
    const amount = roundTo4(Number(installment.amount));

    const cashTx = await cashTransactionService.create(
      ctx.companyId,
      ctx.branchId,
      ctx.fiscalYearId,
      {
        transactionKind: 'RECEIPT',
        voucherNumber: input.voucherNumber,
        date: input.collectionDate ?? new Date(),
        amount,
        currencyCode: 'EGP',
        customerId: installment.contract.customerId,
        offsetAccountId: accounts.realEstateArAccountId,
        safeId: input.safeId,
        bankAccountId: input.bankAccountId,
        description: `Installment #${installment.installmentNumber} — ${installment.contract.contractNumber}`,
      }
    );

    const posted = await treasuryPostingService.postCashTransaction(treasuryCtx, cashTx.id);

    const newOutstanding = roundTo4(
      Number(installment.contract.outstandingArBalance) - amount
    );

    return prisma.$transaction(async (tx) => {
      await tx.unitInstallment.update({
        where: { id: installmentId },
        data: {
          status: 'PAID',
          paidAt: new Date(),
          paymentTransactionId: posted!.id,
        },
      });
      return tx.unitContract.update({
        where: { id: installment.contractId },
        data: { outstandingArBalance: new Decimal(Math.max(0, newOutstanding)) },
        include: { installments: { orderBy: { installmentNumber: 'asc' } } },
      });
    });
  }

  async handoverUnit(ctx: JournalPostingContext, contractId: string, handoverDate?: Date) {
    const contract = await this.getById(ctx.companyId, contractId);
    if (!contract.contractJournalEntryId) {
      throw new AppError(422, 'Post contract execution before handover');
    }
    if (contract.handoverJournalEntryId) {
      throw new AppError(400, 'Unit already handed over');
    }
    if (contract.status === 'COMPLETED') {
      throw new AppError(400, 'Contract already completed');
    }

    const accounts = await realEstateAccountResolverService.resolveAccounts(ctx.companyId);
    const unearned = roundTo4(Number(contract.unearnedRevenueBalance));
    if (unearned <= 0) {
      throw new AppError(422, 'No unearned revenue balance to recognize');
    }

    const ccId = contract.unit.building.project.costCenterId ?? undefined;
    const legacyGlNum = await this.allocateGlNum(ctx);
    const date = handoverDate ?? contract.deliveryDate ?? new Date();

    const revenueLine: {
      accountId: string;
      debit: number;
      credit: number;
      costCenterId?: string;
    } = {
      accountId: accounts.realEstateRevenueAccountId,
      debit: 0,
      credit: unearned,
    };
    if (ccId) revenueLine.costCenterId = ccId;

    return prisma.$transaction(async (tx) => {
      const je = await journalPostingService.createAndPostInTx(tx, ctx, {
        fiscalYearId: ctx.fiscalYearId!,
        legacyGlNum,
        date,
        description: `Unit handover ${contract.contractNumber}`,
        currencyCode: 'EGP',
        exchangeRate: 1,
        entryType: 'UnitHandover',
        sourceType: 'UH',
        sourceNumber: contract.contractNumber,
        lines: journalLines([
          {
            accountId: accounts.unearnedRealEstateRevenueAccountId,
            debit: unearned,
            credit: 0,
          },
          revenueLine,
        ]),
      });

      await tx.realEstateUnit.update({
        where: { id: contract.unitId },
        data: { status: 'DELIVERED' },
      });

      return tx.unitContract.update({
        where: { id: contractId },
        data: {
          status: 'COMPLETED',
          handoverJournalEntryId: je.id,
          handoverAt: new Date(),
          unearnedRevenueBalance: new Decimal(0),
        },
        include: { installments: true },
      });
    });
  }

  /**
   * Wave 2 fix: reverses a unit handover — dated contra entry against the
   * handover JE, restores the unearned revenue balance, puts the unit back
   * to SOLD, and reopens the contract as ACTIVE.
   */
  async unpostHandover(ctx: JournalPostingContext, contractId: string) {
    const contract = await this.getById(ctx.companyId, contractId);
    if (!contract.handoverJournalEntryId) {
      throw new AppError(400, 'Contract has no handover journal entry to reverse');
    }

    return prisma.$transaction(async (tx) => {
      const originalJe = await tx.journalEntry.findFirst({
        where: { id: contract.handoverJournalEntryId!, companyId: ctx.companyId },
        include: { lines: true },
      });
      const restoredUnearned = roundTo4(
        originalJe?.lines
          .filter((l) => Number(l.debit) > 0)
          .reduce((s, l) => s + Number(l.debit), 0) ?? 0
      );

      await journalPostingService.reverseJournalEntryInTx(tx, ctx, contract.handoverJournalEntryId!, {
        reason: 'Unit handover unposted',
      });

      await tx.realEstateUnit.update({
        where: { id: contract.unitId },
        data: { status: 'SOLD' },
      });

      return tx.unitContract.update({
        where: { id: contractId },
        data: {
          status: 'ACTIVE',
          handoverJournalEntryId: null,
          handoverAt: null,
          unearnedRevenueBalance: new Decimal(restoredUnearned),
        },
        include: { installments: true },
      });
    });
  }

  /**
   * Wave 3 fix: `status` has always documented `ACTIVE | TERMINATED |
   * COMPLETED`, but no code path ever wrote `TERMINATED` — a defaulting
   * buyer's contract had no way to close out; the unit stayed `SOLD`
   * forever. Only allowed before handover (post-handover the unit is
   * delivered — that is a return/rescission, not a termination). Reverses
   * the contract-execution AR/unearned-revenue JE if it was posted, voids
   * remaining unpaid installments, and frees the unit back to `AVAILABLE`.
   * Amounts already collected (PAID installments) are left untouched —
   * any refund/forfeiture is a separate, deliberate accounting action
   * (credit note / manual JE), not implied by termination itself.
   */
  async terminateContract(
    ctx: JournalPostingContext,
    contractId: string,
    reason?: string
  ) {
    const contract = await this.getById(ctx.companyId, contractId);
    if (contract.status === 'TERMINATED') {
      throw new AppError(400, 'Contract is already terminated');
    }
    if (contract.handoverJournalEntryId || contract.status === 'COMPLETED') {
      throw new AppError(
        422,
        'Cannot terminate a contract after unit handover — reverse the handover first if this is a rescission'
      );
    }

    return prisma.$transaction(async (tx) => {
      if (contract.contractJournalEntryId) {
        await journalPostingService.reverseJournalEntryInTx(
          tx,
          ctx,
          contract.contractJournalEntryId,
          { reason: reason ?? `Real estate contract ${contract.contractNumber} terminated` }
        );
      }

      await tx.unitInstallment.updateMany({
        where: { contractId, status: 'PENDING' },
        data: { status: 'CANCELLED' },
      });

      if (contract.unit.status === 'SOLD') {
        await tx.realEstateUnit.update({
          where: { id: contract.unitId },
          data: { status: 'AVAILABLE' },
        });
      }

      return tx.unitContract.update({
        where: { id: contractId },
        data: {
          status: 'TERMINATED',
          contractJournalEntryId: null,
          outstandingArBalance: new Decimal(0),
          unearnedRevenueBalance: new Decimal(0),
        },
        include: { installments: { orderBy: { installmentNumber: 'asc' } } },
      });
    });
  }

  /**
   * Wave 3 fix: replaces the not-yet-paid installments with a freshly
   * generated schedule (e.g. after a restructuring/payment-plan change),
   * preserving the total remaining principal/interest and every already
   * PAID installment untouched. New installment numbers continue after the
   * highest existing number so the `(contractId, installmentNumber)`
   * unique constraint never collides with paid history.
   */
  async regenerateInstallments(
    companyId: string,
    contractId: string,
    input: {
      fromDate: Date;
      frequency: InstallmentFrequency;
      installmentCount: number;
    }
  ) {
    const contract = await this.getById(companyId, contractId);
    if (contract.status !== 'ACTIVE') {
      throw new AppError(422, 'Only active contracts can have their installment schedule regenerated');
    }
    const pending = contract.installments.filter((i) => i.status === 'PENDING');
    if (pending.length === 0) {
      throw new AppError(422, 'No pending installments to regenerate');
    }

    const remainingPrincipal = roundTo4(pending.reduce((s, i) => s + Number(i.amount), 0));
    const remainingInterest = roundTo4(pending.reduce((s, i) => s + Number(i.interestPortion), 0));
    const highestNumber = contract.installments.reduce(
      (max, i) => Math.max(max, i.installmentNumber),
      0
    );

    const schedule = installmentScheduleService.generate({
      contractDate: input.fromDate,
      totalContractAmount: remainingPrincipal,
      downPayment: 0,
      financingInterest: remainingInterest,
      frequency: input.frequency,
      installmentCount: input.installmentCount,
    });

    return prisma.$transaction(async (tx) => {
      await tx.unitInstallment.deleteMany({ where: { contractId, status: 'PENDING' } });

      for (const row of schedule) {
        if (row.amount === 0) continue;
        await tx.unitInstallment.create({
          data: {
            contractId,
            installmentNumber: highestNumber + row.installmentNumber + 1,
            dueDate: row.dueDate,
            amount: new Decimal(row.amount),
            originalAmount: new Decimal(row.amount),
            paidAmount: new Decimal(0),
            balance: new Decimal(row.amount),
            installmentType: 'REGULAR_INSTALLMENT',
            interestPortion: new Decimal(row.interestPortion),
            status: 'PENDING',
          },
        });
      }

      return tx.unitContract.findUnique({
        where: { id: contractId },
        include: { installments: { orderBy: { installmentNumber: 'asc' } } },
      });
    });
  }
}

export const unitContractService = new UnitContractService();
