import { Prisma } from '@prisma/client';
import prisma from '../../../shared/database/prisma';
import { ContractStateError, UnitContractNotFoundError } from '../errors/real-estate-domain.errors';
import type { CancelContractDto } from '../types/portfolio.types';
import { DEFAULT_FORFEITURE_PENALTY_RATE } from '../types/portfolio.types';
import { enqueueUnitCancellationReleasedJob } from '../../automation/producers/domain-event.producer';
import { money, moneyMax, moneyZero, rate, sumMoney } from '../utils/money-decimal';

type Db = Prisma.TransactionClient | typeof prisma;

const CANCELLABLE_STATUSES = ['ACTIVE', 'RESALE_IN_PROGRESS'];
const UNCLEARED_PDC_STATUSES = [
  'UNDER_SAFE_CUSTODY',
  'DEPOSITED_UNDER_COLLECTION',
  'BOUNCED_RETURNED',
] as const;

export class UnitCancellationSettlementService {
  async processContractCancellationInTx(
    db: Db,
    companyId: string,
    contractId: string,
    cancellationDto: CancelContractDto = {}
  ) {
    const contract = await db.unitContract.findFirst({
      where: { id: contractId, companyId },
      include: {
        installments: true,
        postDatedCheques: true,
        propertyUnit: true,
      },
    });
    if (!contract) throw new UnitContractNotFoundError(companyId, contractId);
    if (!CANCELLABLE_STATUSES.includes(contract.status)) {
      throw new ContractStateError(contract.id, contract.status, CANCELLABLE_STATUSES);
    }

    const paidFromInstallments = sumMoney(contract.installments.map((row) => row.paidAmount));
    const clearedUnlinkedPdcs = sumMoney(
      contract.postDatedCheques
        .filter((cheque) => cheque.status === 'CLEARED_COLLECTED' && !cheque.unitInstallmentId)
        .map((cheque) => cheque.amount)
    );
    const totalAmountPaidByClient = money(paidFromInstallments.plus(clearedUnlinkedPdcs));

    const sellingPrice = money(
      contract.totalSellingPrice.gt(0) ? contract.totalSellingPrice : contract.totalContractAmount
    );
    const forfeiturePenaltyRate = rate(cancellationDto.forfeiturePenaltyRate ?? DEFAULT_FORFEITURE_PENALTY_RATE);
    const forfeiturePenaltyAmount = money(sellingPrice.mul(forfeiturePenaltyRate));
    const netRefundableToClient = moneyMax(
      moneyZero(),
      money(totalAmountPaidByClient.minus(forfeiturePenaltyAmount))
    );

    const settlement = await db.unitCancellationSettlement.create({
      data: {
        unitContractId: contract.id,
        cancellationDate: cancellationDto.cancellationDate ?? new Date(),
        totalAmountPaidByClient,
        forfeiturePenaltyRate,
        forfeiturePenaltyAmount,
        netRefundableToClient,
        refundStatus: cancellationDto.refundStatus ?? 'HELD_UNTIL_RESALE',
      },
    });

    await db.unitContract.update({
      where: { id: contract.id },
      data: {
        status: 'TERMINATED_FORFEITED',
        resaleLock: false,
      },
    });

    const unpaidInstallmentIds = contract.installments
      .filter((row) => money(row.balance).gt(0) && row.status !== 'PAID')
      .map((row) => row.id);
    if (unpaidInstallmentIds.length > 0) {
      await db.unitInstallment.updateMany({
        where: { id: { in: unpaidInstallmentIds }, contract: { companyId } },
        data: { status: 'CANCELLED', balance: moneyZero() },
      });
    }

    const unclearedChequeIds = contract.postDatedCheques
      .filter((cheque) =>
        UNCLEARED_PDC_STATUSES.includes(cheque.status as (typeof UNCLEARED_PDC_STATUSES)[number])
      )
      .map((cheque) => cheque.id);
    if (unclearedChequeIds.length > 0) {
      await db.postDatedCheque.updateMany({
        where: { id: { in: unclearedChequeIds }, companyId },
        data: {
          status: 'REPLACED_CANCELLED',
          bouncedReason: 'VOIDED_ON_CONTRACT_CANCELLATION',
        },
      });
    }

    if (contract.propertyUnitId) {
      await db.propertyUnit.update({
        where: { id: contract.propertyUnitId },
        data: { status: 'AVAILABLE' },
      });
    }

    await db.realEstateUnit.update({
      where: { id: contract.unitId },
      data: { status: 'AVAILABLE' },
    });

    const result = {
      settlement,
      totalAmountPaidByClient,
      forfeiturePenaltyAmount,
      netRefundableToClient,
      propertyUnitId: contract.propertyUnitId,
      legacyUnitId: contract.unitId,
    };

    return result;
  }

  async processContractCancellation(companyId: string, contractId: string, cancellationDto: CancelContractDto = {}) {
    const result = await prisma.$transaction((tx) =>
      this.processContractCancellationInTx(tx, companyId, contractId, cancellationDto)
    );

    await enqueueUnitCancellationReleasedJob({
      companyId,
      contractId,
      settlementId: result.settlement.id,
      propertyUnitId: result.propertyUnitId,
      legacyUnitId: result.legacyUnitId,
      cancellationDate: result.settlement.cancellationDate.toISOString(),
    });

    return result;
  }
}

export const unitCancellationSettlementService = new UnitCancellationSettlementService();
