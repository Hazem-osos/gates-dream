import { Prisma, type UnitInstallmentType, type UnitPaymentPlanType } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import prisma from '../../../shared/database/prisma';
import {
  ContractStateError,
  InstallmentMismatchError,
  UnitContractNotFoundError,
} from '../errors/real-estate-domain.errors';
import type {
  GenerateContractScheduleParams,
  GeneratedScheduleLine,
  InstallmentFrequency,
  ScheduleComponentInput,
} from '../types/portfolio.types';
import { DEFAULT_DAILY_LATE_FEE_RATE } from '../types/portfolio.types';
import { addUtcMonths } from '../utils/calendar-days';
import { money, moneyZero, rate, sumMoney } from '../utils/money-decimal';
import { roundTo4 } from '../../../shared/utils/decimal-round';

export type { InstallmentFrequency };

export interface ScheduleInstallmentRow {
  installmentNumber: number;
  dueDate: Date;
  amount: number;
  interestPortion: number;
}

export interface GenerateScheduleInput {
  contractDate: Date;
  deliveryDate?: Date;
  totalContractAmount: number;
  downPayment: number;
  financingInterest?: number;
  frequency: InstallmentFrequency;
  installmentCount: number;
  /** Optional lump sum due on delivery (balloon). */
  balloonOnDelivery?: number;
}

type Db = Prisma.TransactionClient | typeof prisma;

function addMonths(date: Date, months: number): Date {
  const d = new Date(date);
  d.setUTCMonth(d.getUTCMonth() + months);
  return d;
}

function monthsPerPeriod(frequency: InstallmentFrequency): number {
  switch (frequency) {
    case 'MONTHLY':
      return 1;
    case 'QUARTERLY':
      return 3;
    case 'SEMI_ANNUAL':
      return 6;
    case 'ANNUAL':
      return 12;
    default:
      return 3;
  }
}

function resolveComponentAmount(sellingPrice: Decimal, component?: ScheduleComponentInput): Decimal {
  if (!component) return moneyZero();
  if (component.amount != null) return money(component.amount);
  if (component.rateOfSellingPrice != null) {
    return money(sellingPrice.mul(rate(component.rateOfSellingPrice)));
  }
  return moneyZero();
}

function inferPaymentPlanType(params: GenerateContractScheduleParams): UnitPaymentPlanType {
  if (params.annualBalloons && params.annualBalloons.length > 0) return 'CUSTOM_BALLOON';
  if (params.reservation || params.contractingDownpayment) return 'FRONT_LOADED';
  return 'EQUAL_INSTALLMENTS';
}

/**
 * Wave 3 equal-installment helper (JS number). Kept for existing contract create/reschedule.
 */
export class InstallmentScheduleService {
  generate(input: GenerateScheduleInput): ScheduleInstallmentRow[] {
    const down = roundTo4(input.downPayment);
    const balloon = roundTo4(input.balloonOnDelivery ?? 0);
    const interest = roundTo4(input.financingInterest ?? 0);
    const principal = roundTo4(input.totalContractAmount - down - balloon);
    const count = Math.max(1, input.installmentCount);
    const base = roundTo4(principal / count);
    const rows: ScheduleInstallmentRow[] = [];
    const step = monthsPerPeriod(input.frequency);

    if (down > 0) {
      rows.push({
        installmentNumber: 0,
        dueDate: new Date(input.contractDate),
        amount: down,
        interestPortion: 0,
      });
    }

    let allocated = 0;
    for (let i = 1; i <= count; i++) {
      const isLast = i === count;
      const amount = isLast ? roundTo4(principal - allocated) : base;
      allocated = roundTo4(allocated + amount);
      const interestSlice = isLast
        ? roundTo4(interest - rows.reduce((s, r) => s + r.interestPortion, 0))
        : roundTo4(interest / count);
      rows.push({
        installmentNumber: i,
        dueDate: addMonths(input.contractDate, step * i),
        amount: roundTo4(amount + (i === count ? 0 : 0)),
        interestPortion: Math.max(0, interestSlice),
      });
    }

    if (balloon > 0) {
      const due = input.deliveryDate ?? addMonths(input.contractDate, step * (count + 1));
      rows.push({
        installmentNumber: count + 1,
        dueDate: due,
        amount: balloon,
        interestPortion: 0,
      });
    }

    return rows;
  }

  buildContractScheduleLines(
    sellingPrice: Decimal,
    maintenanceDeposit: Decimal,
    contractDate: Date,
    deliveryDate: Date | null | undefined,
    params: GenerateContractScheduleParams
  ): GeneratedScheduleLine[] {
    const lateFeeRate = rate(params.dailyLateFeeRate ?? DEFAULT_DAILY_LATE_FEE_RATE);
    const step = monthsPerPeriod(params.regular.frequency);
    const lines: Array<Omit<GeneratedScheduleLine, 'installmentNumber'>> = [];

    const push = (
      installmentType: UnitInstallmentType,
      originalAmount: Decimal,
      dueDate: Date
    ) => {
      if (originalAmount.lte(0)) return;
      lines.push({ installmentType, dueDate, originalAmount: money(originalAmount), dailyLateFeeRate: lateFeeRate });
    };

    const reservation = resolveComponentAmount(sellingPrice, params.reservation);
    push('RESERVATION_DEPOSIT', reservation, params.reservation?.dueDate ?? contractDate);

    const contracting = resolveComponentAmount(sellingPrice, params.contractingDownpayment);
    push(
      'CONTRACTING_DOWNPAYMENT',
      contracting,
      params.contractingDownpayment?.dueDate ?? contractDate
    );

    const delivery = resolveComponentAmount(sellingPrice, params.delivery);
    const deliveryDue = params.delivery?.dueDate ?? deliveryDate ?? addUtcMonths(contractDate, step);

    const balloons: Array<{ amount: Decimal; dueDate: Date }> = [];
    for (const balloon of params.annualBalloons ?? []) {
      const amount = resolveComponentAmount(sellingPrice, balloon);
      if (amount.lte(0)) continue;
      balloons.push({ amount, dueDate: balloon.dueDate });
    }

    const allocatedUpfront = sumMoney([
      reservation,
      contracting,
      delivery,
      ...balloons.map((b) => b.amount),
    ]);
    let remainder = money(sellingPrice.minus(allocatedUpfront));

    if (remainder.lt(0)) {
      throw new InstallmentMismatchError(sellingPrice.toFixed(4), allocatedUpfront.toFixed(4));
    }

    const regularCount = Math.max(0, params.regular.count);
    if (remainder.gt(0) && regularCount < 1) {
      if (delivery.gt(0)) {
        push('DELIVERY_PAYMENT', money(delivery.plus(remainder)), deliveryDue);
        remainder = moneyZero();
      } else if (balloons.length > 0) {
        balloons[balloons.length - 1].amount = money(balloons[balloons.length - 1].amount.plus(remainder));
        remainder = moneyZero();
      } else {
        throw new InstallmentMismatchError(
          sellingPrice.toFixed(4),
          allocatedUpfront.toFixed(4)
        );
      }
    } else if (delivery.gt(0)) {
      push('DELIVERY_PAYMENT', delivery, deliveryDue);
    }

    if (remainder.gt(0) && regularCount > 0) {
      const start = params.regular.startDate ?? addUtcMonths(contractDate, step);
      const base = money(remainder.div(regularCount));
      let allocatedRegulars = moneyZero();
      for (let i = 1; i <= regularCount; i++) {
        const isLast = i === regularCount;
        const amount = isLast ? money(remainder.minus(allocatedRegulars)) : base;
        allocatedRegulars = money(allocatedRegulars.plus(amount));
        push('REGULAR_INSTALLMENT', amount, addUtcMonths(start, step * (i - 1)));
      }
    }

    for (const balloon of balloons) {
      push('ANNUAL_BALLOON', balloon.amount, balloon.dueDate);
    }

    const maintenanceDue =
      params.maintenanceDueDate ??
      (deliveryDate ? addUtcMonths(deliveryDate, -1) : contractDate);
    push('MAINTENANCE_DEPOSIT', maintenanceDeposit, maintenanceDue);

    const numbered: GeneratedScheduleLine[] = lines
      .sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime())
      .map((line, index) => ({ ...line, installmentNumber: index + 1 }));

    const actual = sumMoney(numbered.map((line) => line.originalAmount));
    const expected = money(sellingPrice.plus(maintenanceDeposit));
    if (!actual.eq(expected)) {
      throw new InstallmentMismatchError(expected.toFixed(4), actual.toFixed(4));
    }

    return numbered;
  }

  async generateContractSchedule(
    companyId: string,
    contractId: string,
    params: GenerateContractScheduleParams
  ) {
    return prisma.$transaction((tx) => this.generateContractScheduleInTx(tx, companyId, contractId, params));
  }

  async generateContractScheduleInTx(
    db: Db,
    companyId: string,
    contractId: string,
    params: GenerateContractScheduleParams
  ) {
    const contract = await db.unitContract.findFirst({
      where: { id: contractId, companyId },
      include: { installments: true },
    });
    if (!contract) throw new UnitContractNotFoundError(companyId, contractId);

    const sellingPrice = money(contract.totalSellingPrice).gt(0)
      ? money(contract.totalSellingPrice)
      : money(contract.totalContractAmount);
    const maintenanceDeposit = money(contract.maintenanceDeposit).gt(0)
      ? money(contract.maintenanceDeposit)
      : money(contract.maintenanceAmount);

    const lines = this.buildContractScheduleLines(
      sellingPrice,
      maintenanceDeposit,
      contract.contractDate,
      contract.deliveryDate,
      params
    );

    const paidRows = contract.installments.filter((row) => money(row.paidAmount).gt(0));
    if (paidRows.length > 0) {
      throw new ContractStateError(contract.id, contract.status, ['ACTIVE with no paid installments']);
    }

    if (contract.installments.length > 0 && !params.replaceExisting) {
      throw new ContractStateError(contract.id, contract.status, ['ACTIVE with empty schedule or replaceExisting']);
    }

    if (contract.installments.length > 0) {
      await db.unitInstallment.deleteMany({ where: { contractId: contract.id } });
    }

    for (const line of lines) {
      await db.unitInstallment.create({
        data: {
          contractId: contract.id,
          installmentType: line.installmentType,
          installmentNumber: line.installmentNumber,
          dueDate: line.dueDate,
          amount: line.originalAmount,
          originalAmount: line.originalAmount,
          paidAmount: moneyZero(),
          balance: line.originalAmount,
          dailyLateFeeRate: line.dailyLateFeeRate,
          accumulatedLateFee: moneyZero(),
          interestPortion: moneyZero(),
          status: 'UNPAID',
        },
      });
    }

    await db.unitContract.update({
      where: { id: contract.id },
      data: { paymentPlanType: inferPaymentPlanType(params) },
    });

    return db.unitContract.findFirst({
      where: { id: contract.id, companyId },
      include: { installments: { orderBy: { installmentNumber: 'asc' } } },
    });
  }
}

export const installmentScheduleService = new InstallmentScheduleService();
