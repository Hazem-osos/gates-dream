import { Prisma, type UnitContract, type UnitInstallment, type UnitResaleTransfer } from '@prisma/client';
import prisma from '../../../shared/database/prisma';
import {
  BuyerCustomerNotFoundError,
  ContractStateError,
  RealEstateDomainError,
  ResaleTransferBlockedError,
  UnitContractNotFoundError,
} from '../errors/real-estate-domain.errors';
import type { ProcessResaleTransferParams, RequestResaleTransferDto } from '../types/portfolio.types';
import { DEFAULT_ASSIGNMENT_FEE_RATE, OPEN_INSTALLMENT_STATUSES } from '../types/portfolio.types';
import { money, moneyZero, rate } from '../utils/money-decimal';

type Db = Prisma.TransactionClient | typeof prisma;

type ContractWithInstallments = UnitContract & { installments: UnitInstallment[] };

export class UnitResaleTransferService {
  async listTransfers(companyId: string) {
    return prisma.unitResaleTransfer.findMany({
      where: { contract: { companyId } },
      include: {
        contract: {
          select: {
            id: true,
            contractNumber: true,
            status: true,
            resaleLock: true,
            unit: { select: { unitCode: true } },
            installments: { select: { id: true, status: true, balance: true, dueDate: true } },
          },
        },
        seller: { select: { id: true, arabicName: true, code: true } },
        newBuyer: { select: { id: true, arabicName: true, code: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async processResaleTransfer(companyId: string, params: ProcessResaleTransferParams) {
    return prisma.$transaction(async (tx) => {
      const contract = await this.requireContract(tx, companyId, params.unitContractId);
      const pendingUnpaid = await tx.unitResaleTransfer.findFirst({
        where: {
          unitContractId: contract.id,
          clearanceStatus: 'PENDING_CLEARANCE',
          isAssignmentFeePaid: false,
        },
      });

      if (contract.resaleLock && pendingUnpaid) {
        if (!params.paymentRef) {
          throw new ResaleTransferBlockedError(
            contract.id,
            'Resale lock is active and the assignment fee is unpaid'
          );
        }
        return this.clearAndExecuteTransferInTx(
          tx,
          companyId,
          pendingUnpaid.id,
          params.paymentRef,
          params.approvedByUserId
        );
      }

      const transfer = await this.requestResaleTransferInTx(tx, companyId, params);
      if (!params.paymentRef) {
        return { transfer, successorContract: null };
      }

      return this.clearAndExecuteTransferInTx(tx, companyId, transfer.id, params.paymentRef, params.approvedByUserId);
    });
  }

  async requestResaleTransfer(companyId: string, dto: RequestResaleTransferDto) {
    return prisma.$transaction((tx) => this.requestResaleTransferInTx(tx, companyId, dto));
  }

  async requestResaleTransferInTx(db: Db, companyId: string, dto: RequestResaleTransferDto) {
    const contract = await this.requireContract(db, companyId, dto.unitContractId);
    if (contract.status !== 'ACTIVE') {
      throw new ContractStateError(contract.id, contract.status, ['ACTIVE']);
    }
    await this.assertResaleLockAllowsNewRequest(db, contract);
    await this.requireBuyer(db, companyId, dto.newBuyerCustomerId);

    const currentUnitMarketValue = money(dto.currentUnitMarketValue);
    const assignmentFeeRate = rate(dto.assignmentFeeRate ?? DEFAULT_ASSIGNMENT_FEE_RATE);
    const assignmentFeeAmount = money(currentUnitMarketValue.mul(assignmentFeeRate));
    const sellingPrice = money(contract.totalSellingPrice.gt(0) ? contract.totalSellingPrice : contract.totalContractAmount);

    const transfer = await db.unitResaleTransfer.create({
      data: {
        unitContractId: contract.id,
        sellerCustomerId: contract.customerId,
        newBuyerCustomerId: dto.newBuyerCustomerId,
        currentUnitMarketValue,
        assignmentFeeRate,
        assignmentFeeAmount,
        isAssignmentFeePaid: false,
        clearanceStatus: 'PENDING_CLEARANCE',
      },
    });

    await db.unitContract.update({
      where: { id: contract.id },
      data: {
        status: 'RESALE_IN_PROGRESS',
        resaleLock: true,
      },
    });

    return {
      ...transfer,
      contractSellingPrice: sellingPrice,
      marketPremium: money(currentUnitMarketValue.minus(sellingPrice)),
    };
  }

  async clearAndExecuteTransfer(
    companyId: string,
    transferId: string,
    paymentRef: string,
    approvedByUserId?: string
  ) {
    return prisma.$transaction((tx) =>
      this.clearAndExecuteTransferInTx(tx, companyId, transferId, paymentRef, approvedByUserId)
    );
  }

  async clearAndExecuteTransferInTx(
    db: Db,
    companyId: string,
    transferId: string,
    paymentRef: string,
    approvedByUserId?: string
  ) {
    const transfer = await db.unitResaleTransfer.findFirst({
      where: { id: transferId, contract: { companyId } },
    });
    if (!transfer) {
      throw new RealEstateDomainError(404, 'RESALE_TRANSFER_NOT_FOUND', 'Resale transfer not found', {
        companyId,
        transferId,
      });
    }
    if (transfer.clearanceStatus !== 'PENDING_CLEARANCE') {
      throw new RealEstateDomainError(409, 'RESALE_TRANSFER_NOT_PENDING', 'Resale transfer is not pending clearance', {
        transferId,
        clearanceStatus: transfer.clearanceStatus,
      });
    }
    if (!paymentRef.trim()) {
      throw new ResaleTransferBlockedError(transfer.unitContractId, 'Assignment fee payment reference is required');
    }

    const contract = await this.requireContract(db, companyId, transfer.unitContractId);
    const overdueUnpaid = contract.installments.filter(
      (row) =>
        OPEN_INSTALLMENT_STATUSES.includes(row.status as (typeof OPEN_INSTALLMENT_STATUSES)[number]) &&
        money(row.balance).gt(0) &&
        row.dueDate < new Date()
    );
    if (overdueUnpaid.length > 0) {
      throw new ResaleTransferBlockedError(
        contract.id,
        'Unpaid overdue installments must be collected before transfer clearance'
      );
    }

    const cleared = await db.unitResaleTransfer.update({
      where: { id: transfer.id },
      data: {
        clearanceStatus: 'FINANCIALLY_CLEARED',
        isAssignmentFeePaid: true,
        approvedByUserId: approvedByUserId ?? transfer.approvedByUserId,
      },
    });

    await db.unitContract.update({
      where: { id: contract.id },
      data: {
        status: 'TRANSFERRED',
        resaleLock: false,
      },
    });

    const successorContract = await this.cloneContractForNewBuyer(db, companyId, contract, cleared);

    return { transfer: cleared, successorContract, paymentRef };
  }

  private async cloneContractForNewBuyer(
    db: Db,
    companyId: string,
    oldContract: ContractWithInstallments,
    transfer: UnitResaleTransfer
  ) {
    const remaining = oldContract.installments.filter(
      (row) => money(row.balance).gt(0) && row.status !== 'CANCELLED' && row.status !== 'PAID'
    );
    const remainingPrincipal = remaining.reduce((acc, row) => acc.plus(money(row.balance)), moneyZero());
    const contractNumber = await this.nextTransferredContractNumber(db, companyId, oldContract.contractNumber);

    const successor = await db.unitContract.create({
      data: {
        companyId,
        unitId: oldContract.unitId,
        propertyUnitId: oldContract.propertyUnitId,
        customerId: transfer.newBuyerCustomerId,
        contractNumber,
        contractDate: new Date(),
        deliveryDate: oldContract.deliveryDate,
        totalContractAmount: remainingPrincipal,
        totalSellingPrice: remainingPrincipal.gt(0) ? remainingPrincipal : money(transfer.currentUnitMarketValue),
        downPayment: moneyZero(),
        maintenanceAmount: oldContract.maintenanceAmount,
        maintenanceDeposit: oldContract.maintenanceDeposit,
        discountAmount: moneyZero(),
        financingInterest: moneyZero(),
        paymentPlanType: oldContract.paymentPlanType,
        status: 'ACTIVE',
        resaleLock: false,
      },
    });

    let number = 1;
    for (const row of remaining.sort((a, b) => a.installmentNumber - b.installmentNumber)) {
      const originalAmount = money(row.balance);
      await db.unitInstallment.create({
        data: {
          contractId: successor.id,
          installmentType: row.installmentType,
          installmentNumber: number,
          dueDate: row.dueDate,
          amount: originalAmount,
          originalAmount,
          paidAmount: moneyZero(),
          balance: originalAmount,
          dailyLateFeeRate: row.dailyLateFeeRate,
          accumulatedLateFee: moneyZero(),
          interestPortion: moneyZero(),
          status: 'UNPAID',
        },
      });
      number += 1;
    }

    return db.unitContract.findFirst({
      where: { id: successor.id, companyId },
      include: { installments: { orderBy: { installmentNumber: 'asc' } } },
    });
  }

  private async nextTransferredContractNumber(db: Db, companyId: string, sourceNumber: string) {
    const prefix = `${sourceNumber}-R`;
    const existing = await db.unitContract.count({
      where: { companyId, contractNumber: { startsWith: prefix } },
    });
    return `${prefix}${existing + 1}`;
  }

  private async assertResaleLockAllowsNewRequest(db: Db, contract: UnitContract) {
    if (!contract.resaleLock) return;

    const pending = await db.unitResaleTransfer.findFirst({
      where: {
        unitContractId: contract.id,
        clearanceStatus: 'PENDING_CLEARANCE',
        isAssignmentFeePaid: false,
      },
    });
    if (pending) {
      throw new ResaleTransferBlockedError(
        contract.id,
        'Resale lock is active and the assignment fee is unpaid'
      );
    }
  }

  private async requireBuyer(db: Db, companyId: string, customerId: string) {
    const buyer = await db.customer.findFirst({
      where: { id: customerId, companyId },
      select: { id: true },
    });
    if (!buyer) throw new BuyerCustomerNotFoundError(companyId, customerId);
    return buyer;
  }

  private async requireContract(db: Db, companyId: string, contractId: string) {
    const contract = await db.unitContract.findFirst({
      where: { id: contractId, companyId },
      include: { installments: true },
    });
    if (!contract) throw new UnitContractNotFoundError(companyId, contractId);
    return contract;
  }
}

export const unitResaleTransferService = new UnitResaleTransferService();
