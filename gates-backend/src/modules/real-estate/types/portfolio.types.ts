import type { UnitInstallmentType } from '@prisma/client';
import type { Decimal } from '@prisma/client/runtime/library';
import type { DecimalInput } from '../utils/money-decimal';

export type InstallmentFrequency = 'MONTHLY' | 'QUARTERLY' | 'SEMI_ANNUAL' | 'ANNUAL';

export type PaymentAllocationOrder = 'LATE_FEES_FIRST' | 'PRINCIPAL_FIRST';

export const DEFAULT_DAILY_LATE_FEE_RATE = '0.0005';
export const DEFAULT_ASSIGNMENT_FEE_RATE = '0.05';
export const DEFAULT_FORFEITURE_PENALTY_RATE = '0.10';

export const OPEN_INSTALLMENT_STATUSES = ['UNPAID', 'PARTIALLY_PAID', 'OVERDUE'] as const;
export const UNPAID_LIKE_STATUSES = ['UNPAID', 'PENDING', 'PARTIALLY_PAID', 'OVERDUE'] as const;

export interface ScheduleComponentInput {
  type?: UnitInstallmentType;
  amount?: DecimalInput;
  rateOfSellingPrice?: DecimalInput;
  dueDate?: Date;
}

export interface GenerateContractScheduleParams {
  reservation?: ScheduleComponentInput;
  contractingDownpayment?: ScheduleComponentInput;
  regular: {
    frequency: InstallmentFrequency;
    count: number;
    startDate?: Date;
  };
  annualBalloons?: Array<{
    dueDate: Date;
    amount?: DecimalInput;
    rateOfSellingPrice?: DecimalInput;
  }>;
  delivery?: ScheduleComponentInput;
  maintenanceDueDate?: Date;
  dailyLateFeeRate?: DecimalInput;
  /** Replace existing unpaid rows. Fails if any installment has a payment. */
  replaceExisting?: boolean;
}

export interface GeneratedScheduleLine {
  installmentType: UnitInstallmentType;
  installmentNumber: number;
  dueDate: Date;
  originalAmount: Decimal;
  dailyLateFeeRate: Decimal;
}

export interface SettleInstallmentOptions {
  allocation?: PaymentAllocationOrder;
  asOfDate?: Date;
  paymentTransactionId?: string;
}

export interface SettleInstallmentResult {
  installmentId: string;
  paidAmount: Decimal;
  balance: Decimal;
  accumulatedLateFee: Decimal;
  status: string;
  allocatedToLateFees: Decimal;
  allocatedToPrincipal: Decimal;
}

export interface RegisterPdcDto {
  chequeNumber: string;
  bankName: string;
  drawerName: string;
  chequeDate: Date;
  amount: DecimalInput;
  unitInstallmentId?: string;
}

export interface RequestResaleTransferDto {
  unitContractId: string;
  newBuyerCustomerId: string;
  currentUnitMarketValue: DecimalInput;
  assignmentFeeRate?: DecimalInput;
}

export interface ProcessResaleTransferParams extends RequestResaleTransferDto {
  paymentRef?: string;
  approvedByUserId?: string;
}

export interface CancelContractDto {
  cancellationDate?: Date;
  forfeiturePenaltyRate?: DecimalInput;
  refundStatus?: 'HELD_UNTIL_RESALE' | 'FULLY_REFUNDED';
}

export interface RentalDistributionDto {
  periodStart: Date;
  periodEnd: Date;
  grossRentCollected: DecimalInput;
  operatingExpenses?: DecimalInput;
  maintenanceReserveDeduction?: DecimalInput;
}

export interface PdcClearedGlPayload {
  sourceType: 'PDC_CLEARED';
  companyId: string;
  chequeId: string;
  unitContractId: string;
  unitInstallmentId: string | null;
  bankAccountId?: string;
  amount: Decimal;
  clearanceDate: Date;
}

export interface RentalDistributionGlPayload {
  sourceType: 'RENTAL_POOL_DISTRIBUTION';
  companyId: string;
  agreementId: string;
  distributionId: string;
  ownerCustomerId: string;
  amounts: {
    grossRentReceived: Decimal;
    operatingExpenses: Decimal;
    maintenanceReserveDeduction: Decimal;
    netOperationalProfit: Decimal;
    developerManagementFee: Decimal;
    distributableToOwner: Decimal;
  };
}
