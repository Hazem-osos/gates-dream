import { Prisma, type UnitInstallment } from '@prisma/client';
import prisma from '../../../shared/database/prisma';
import {
  InstallmentPaymentOverAppliedError,
  RealEstateDomainError,
  UnitInstallmentNotFoundError,
} from '../errors/real-estate-domain.errors';
import type { SettleInstallmentOptions, SettleInstallmentResult } from '../types/portfolio.types';
import { OPEN_INSTALLMENT_STATUSES } from '../types/portfolio.types';
import { differenceInCalendarDays } from '../utils/calendar-days';
import { money, moneyMin, moneyZero, rate, toDecimal } from '../utils/money-decimal';

type Db = Prisma.TransactionClient | typeof prisma;

const OVERDUE_QUERY_STATUSES = [...OPEN_INSTALLMENT_STATUSES];

function daysOverdue(asOfDate: Date, dueDate: Date): number {
  return Math.max(0, differenceInCalendarDays(asOfDate, dueDate));
}

function lateFeeFor(installment: Pick<UnitInstallment, 'balance' | 'dailyLateFeeRate'>, days: number) {
  if (days <= 0) return moneyZero();
  return money(money(installment.balance).mul(rate(installment.dailyLateFeeRate)).mul(days));
}

function deriveSettledStatus(balance: ReturnType<typeof money>, paidAmount: ReturnType<typeof money>): string {
  if (balance.eq(0)) return 'PAID';
  if (paidAmount.gt(0)) return 'PARTIALLY_PAID';
  return 'OVERDUE';
}

export class LateFeeCalculationService {
  async calculateAndApplyOverdueLateFees(companyId: string, asOfDate: Date = new Date()) {
    return prisma.$transaction((tx) => this.calculateAndApplyOverdueLateFeesInTx(tx, companyId, asOfDate));
  }

  async calculateAndApplyOverdueLateFeesInTx(db: Db, companyId: string, asOfDate: Date = new Date()) {
    const overdue = await db.unitInstallment.findMany({
      where: {
        status: { in: [...OVERDUE_QUERY_STATUSES] },
        dueDate: { lt: asOfDate },
        contract: { companyId },
      },
    });

    const updated: UnitInstallment[] = [];
    for (const installment of overdue) {
      const days = daysOverdue(asOfDate, installment.dueDate);
      const accumulatedLateFee = lateFeeFor(installment, days);
      const row = await db.unitInstallment.update({
        where: { id: installment.id },
        data: {
          accumulatedLateFee,
          status: 'OVERDUE',
        },
      });
      updated.push(row);
    }

    return {
      asOfDate,
      processedCount: updated.length,
      installments: updated,
    };
  }

  async applyLateFeeToInstallmentInTx(db: Db, companyId: string, installmentId: string, asOfDate: Date = new Date()) {
    const installment = await this.requireInstallment(db, companyId, installmentId);
    const days = daysOverdue(asOfDate, installment.dueDate);
    const accumulatedLateFee = lateFeeFor(installment, days);
    return db.unitInstallment.update({
      where: { id: installment.id },
      data: {
        accumulatedLateFee,
        status: money(installment.balance).gt(0) ? 'OVERDUE' : installment.status,
      },
    });
  }

  async settleInstallmentPayment(
    companyId: string,
    installmentId: string,
    paymentAmount: Prisma.Decimal | string | number,
    options: SettleInstallmentOptions = {}
  ): Promise<SettleInstallmentResult> {
    return prisma.$transaction((tx) =>
      this.settleInstallmentPaymentInTx(tx, companyId, installmentId, paymentAmount, options)
    );
  }

  async settleInstallmentPaymentInTx(
    db: Db,
    companyId: string,
    installmentId: string,
    paymentAmount: Prisma.Decimal | string | number,
    options: SettleInstallmentOptions = {}
  ): Promise<SettleInstallmentResult> {
    const installment = await this.requireInstallment(db, companyId, installmentId);
    const payment = money(toDecimal(paymentAmount));
    if (payment.lte(0)) {
      throw new RealEstateDomainError(422, 'INVALID_PAYMENT_AMOUNT', 'Payment amount must be greater than zero', {
        installmentId,
        paymentAmount: payment.toFixed(4),
      });
    }

    const originalAmount = money(installment.originalAmount.gt(0) ? installment.originalAmount : installment.amount);
    const currentPaid = money(installment.paidAmount);
    const currentBalance = money(originalAmount.minus(currentPaid));
    const outstandingLateFee = money(installment.accumulatedLateFee);
    const maxApplicable = money(currentBalance.plus(outstandingLateFee));
    if (payment.gt(maxApplicable)) {
      throw new InstallmentPaymentOverAppliedError(
        installmentId,
        payment.toFixed(4),
        maxApplicable.toFixed(4)
      );
    }

    const allocation = options.allocation ?? 'LATE_FEES_FIRST';
    let remaining = payment;
    let allocatedToLateFees = moneyZero();
    let allocatedToPrincipal = moneyZero();

    const applyLateFees = () => {
      const slice = moneyMin(remaining, outstandingLateFee.minus(allocatedToLateFees));
      allocatedToLateFees = money(allocatedToLateFees.plus(slice));
      remaining = money(remaining.minus(slice));
    };
    const applyPrincipal = () => {
      const slice = moneyMin(remaining, currentBalance.minus(allocatedToPrincipal));
      allocatedToPrincipal = money(allocatedToPrincipal.plus(slice));
      remaining = money(remaining.minus(slice));
    };

    if (allocation === 'PRINCIPAL_FIRST') {
      applyPrincipal();
      applyLateFees();
    } else {
      applyLateFees();
      applyPrincipal();
    }

    const paidAmount = money(currentPaid.plus(allocatedToPrincipal));
    const balance = money(originalAmount.minus(paidAmount));
    const accumulatedLateFee = money(outstandingLateFee.minus(allocatedToLateFees));
    const status = deriveSettledStatus(balance, paidAmount);

    const updated = await db.unitInstallment.update({
      where: { id: installment.id },
      data: {
        paidAmount,
        balance,
        accumulatedLateFee,
        status,
        paymentTransactionId: options.paymentTransactionId ?? installment.paymentTransactionId,
        paidAt: status === 'PAID' ? (options.asOfDate ?? new Date()) : installment.paidAt,
      },
    });

    return {
      installmentId: updated.id,
      paidAmount: money(updated.paidAmount),
      balance: money(updated.balance),
      accumulatedLateFee: money(updated.accumulatedLateFee),
      status: updated.status,
      allocatedToLateFees,
      allocatedToPrincipal,
    };
  }

  private async requireInstallment(db: Db, companyId: string, installmentId: string) {
    const installment = await db.unitInstallment.findFirst({
      where: { id: installmentId, contract: { companyId } },
    });
    if (!installment) throw new UnitInstallmentNotFoundError(companyId, installmentId);
    return installment;
  }
}

export const lateFeeCalculationService = new LateFeeCalculationService();
