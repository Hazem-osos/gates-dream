import { Prisma, type PostDatedCheque, type PostDatedChequeStatus } from '@prisma/client';
import prisma from '../../../shared/database/prisma';
import {
  BankAccountNotFoundError,
  ChequeInvalidStateError,
  PostDatedChequeNotFoundError,
  UnitContractNotFoundError,
  UnitInstallmentNotFoundError,
} from '../errors/real-estate-domain.errors';
import type { PdcClearedGlPayload, RegisterPdcDto } from '../types/portfolio.types';
import { money, moneyMin } from '../utils/money-decimal';
import { enqueueChequeBouncedJob } from '../../automation/producers/domain-event.producer';
import { lateFeeCalculationService } from './late-fee-calculation.service';

type Db = Prisma.TransactionClient | typeof prisma;

function assertChequeStatus(cheque: PostDatedCheque, expected: PostDatedChequeStatus[]) {
  if (!expected.includes(cheque.status)) {
    throw new ChequeInvalidStateError(cheque.id, cheque.status, expected);
  }
}

export class PdcPortfolioService {
  async listPortfolio(companyId: string) {
    const cheques = await prisma.postDatedCheque.findMany({
      where: { companyId },
      include: {
        contract: {
          select: {
            id: true,
            contractNumber: true,
            customer: { select: { id: true, arabicName: true, code: true } },
            unit: { select: { id: true, unitCode: true } },
          },
        },
        installment: { select: { id: true, installmentNumber: true, installmentType: true } },
      },
      orderBy: { chequeDate: 'asc' },
    });

    const sum = (status: PostDatedChequeStatus) =>
      cheques.filter((row) => row.status === status).reduce((acc, row) => acc + Number(row.amount), 0);
    const count = (status: PostDatedChequeStatus) => cheques.filter((row) => row.status === status).length;
    const now = Date.now();
    const dueIn7Days = cheques.filter((row) => {
      const due = new Date(row.chequeDate).getTime();
      return row.status === 'UNDER_SAFE_CUSTODY' && due >= now && due <= now + 7 * 24 * 60 * 60 * 1000;
    });

    return {
      cheques,
      stats: {
        inCustodyCount: count('UNDER_SAFE_CUSTODY'),
        inCustodyValue: sum('UNDER_SAFE_CUSTODY'),
        underCollectionCount: count('DEPOSITED_UNDER_COLLECTION'),
        underCollectionValue: sum('DEPOSITED_UNDER_COLLECTION'),
        clearedCount: count('CLEARED_COLLECTED'),
        clearedValue: sum('CLEARED_COLLECTED'),
        bouncedCount: count('BOUNCED_RETURNED'),
        bouncedValue: sum('BOUNCED_RETURNED'),
        dueIn7DaysCount: dueIn7Days.length,
      },
    };
  }

  async registerCheques(companyId: string, unitContractId: string, chequesDto: RegisterPdcDto[]) {
    return prisma.$transaction((tx) => this.registerChequesInTx(tx, companyId, unitContractId, chequesDto));
  }

  async registerChequesInTx(
    db: Db,
    companyId: string,
    unitContractId: string,
    chequesDto: RegisterPdcDto[]
  ) {
    const contract = await db.unitContract.findFirst({
      where: { id: unitContractId, companyId },
    });
    if (!contract) throw new UnitContractNotFoundError(companyId, unitContractId);

    const created: PostDatedCheque[] = [];
    for (const dto of chequesDto) {
      if (dto.unitInstallmentId) {
        const installment = await db.unitInstallment.findFirst({
          where: { id: dto.unitInstallmentId, contractId: contract.id, contract: { companyId } },
        });
        if (!installment) {
          throw new UnitInstallmentNotFoundError(companyId, dto.unitInstallmentId);
        }
      }

      const cheque = await db.postDatedCheque.create({
        data: {
          companyId,
          unitContractId: contract.id,
          unitInstallmentId: dto.unitInstallmentId ?? null,
          chequeNumber: dto.chequeNumber,
          bankName: dto.bankName,
          drawerName: dto.drawerName,
          chequeDate: dto.chequeDate,
          amount: money(dto.amount),
          status: 'UNDER_SAFE_CUSTODY',
        },
      });
      created.push(cheque);
    }

    return created;
  }

  async depositChequesUnderCollection(companyId: string, chequeIds: string[], bankAccountId: string) {
    return prisma.$transaction(async (tx) => {
      const bankAccount = await tx.bankAccount.findFirst({
        where: { id: bankAccountId, companyId },
        select: { id: true },
      });
      if (!bankAccount) throw new BankAccountNotFoundError(companyId, bankAccountId);

      const updated: PostDatedCheque[] = [];
      for (const chequeId of chequeIds) {
        const cheque = await this.requireCheque(tx, companyId, chequeId);
        assertChequeStatus(cheque, ['UNDER_SAFE_CUSTODY']);
        updated.push(
          await tx.postDatedCheque.update({
            where: { id: cheque.id },
            data: { status: 'DEPOSITED_UNDER_COLLECTION' },
          })
        );
      }

      return { bankAccountId, cheques: updated };
    });
  }

  async clearCheque(companyId: string, chequeId: string, clearanceDate: Date) {
    return prisma.$transaction(async (tx) => {
      const cheque = await this.requireCheque(tx, companyId, chequeId);
      assertChequeStatus(cheque, ['DEPOSITED_UNDER_COLLECTION']);

      const cleared = await tx.postDatedCheque.update({
        where: { id: cheque.id },
        data: {
          status: 'CLEARED_COLLECTED',
          collectionDate: clearanceDate,
        },
      });

      let settlement = null;
      if (cleared.unitInstallmentId) {
        const installment = await tx.unitInstallment.findFirst({
          where: { id: cleared.unitInstallmentId, contract: { companyId } },
        });
        if (installment) {
          const originalAmount = money(
            installment.originalAmount.gt(0) ? installment.originalAmount : installment.amount
          );
          const maxApplicable = money(
            originalAmount.minus(money(installment.paidAmount)).plus(money(installment.accumulatedLateFee))
          );
          const applied = moneyMin(money(cleared.amount), maxApplicable);
          if (applied.gt(0)) {
            settlement = await lateFeeCalculationService.settleInstallmentPaymentInTx(
              tx,
              companyId,
              cleared.unitInstallmentId,
              applied,
              { allocation: 'LATE_FEES_FIRST', asOfDate: clearanceDate }
            );
          }
        }
      }

      const journalEntry: PdcClearedGlPayload = {
        sourceType: 'PDC_CLEARED',
        companyId,
        chequeId: cleared.id,
        unitContractId: cleared.unitContractId,
        unitInstallmentId: cleared.unitInstallmentId,
        amount: money(cleared.amount),
        clearanceDate,
      };

      return { cheque: cleared, settlement, journalEntry };
    });
  }

  async bounceCheque(companyId: string, chequeId: string, bounceReason: string) {
    const result = await prisma.$transaction(async (tx) => {
      const cheque = await this.requireCheque(tx, companyId, chequeId);
      assertChequeStatus(cheque, ['DEPOSITED_UNDER_COLLECTION']);

      const bounced = await tx.postDatedCheque.update({
        where: { id: cheque.id },
        data: {
          status: 'BOUNCED_RETURNED',
          bouncedReason: bounceReason,
        },
      });

      let installment = null;
      if (bounced.unitInstallmentId) {
        installment = await lateFeeCalculationService.applyLateFeeToInstallmentInTx(
          tx,
          companyId,
          bounced.unitInstallmentId,
          new Date()
        );
      }

      const contract = await tx.unitContract.findFirst({
        where: { id: bounced.unitContractId, companyId },
        select: { customerId: true },
      });

      return { cheque: bounced, installment, customerId: contract?.customerId ?? null };
    });

    await enqueueChequeBouncedJob({
      companyId,
      chequeId: result.cheque.id,
      unitContractId: result.cheque.unitContractId,
      unitInstallmentId: result.cheque.unitInstallmentId,
      customerId: result.customerId,
      amount: money(result.cheque.amount).toFixed(4),
      bounceReason,
      bouncedAt: new Date().toISOString(),
    });

    return result;
  }

  async replaceCheque(companyId: string, oldChequeId: string, newChequeDto: RegisterPdcDto) {
    return prisma.$transaction(async (tx) => {
      const oldCheque = await this.requireCheque(tx, companyId, oldChequeId);
      assertChequeStatus(oldCheque, [
        'UNDER_SAFE_CUSTODY',
        'DEPOSITED_UNDER_COLLECTION',
        'BOUNCED_RETURNED',
      ]);

      const cancelled = await tx.postDatedCheque.update({
        where: { id: oldCheque.id },
        data: {
          status: 'REPLACED_CANCELLED',
          bouncedReason: oldCheque.bouncedReason,
        },
      });

      const [replacement] = await this.registerChequesInTx(tx, companyId, oldCheque.unitContractId, [
        {
          ...newChequeDto,
          unitInstallmentId: newChequeDto.unitInstallmentId ?? oldCheque.unitInstallmentId ?? undefined,
        },
      ]);

      return { cancelled, replacement };
    });
  }

  private async requireCheque(db: Db, companyId: string, chequeId: string) {
    const cheque = await db.postDatedCheque.findFirst({
      where: { id: chequeId, companyId },
    });
    if (!cheque) throw new PostDatedChequeNotFoundError(companyId, chequeId);
    return cheque;
  }
}

export const pdcPortfolioService = new PdcPortfolioService();
