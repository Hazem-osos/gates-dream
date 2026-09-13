import { z } from 'zod';

const decimalMessage = (field: string) => `${field} must be a valid non-negative number`;
const rateMessage = (field: string) => `${field} must be a decimal rate between 0 and 1 (e.g. 0.05 for 5%)`;

const decimalField = (field: string, opts: { min?: number; max?: number } = {}) =>
  z
    .union([z.string(), z.number()])
    .refine((value) => {
      const n = Number(value);
      if (!Number.isFinite(n)) return false;
      if (opts.min != null && n < opts.min) return false;
      if (opts.max != null && n > opts.max) return false;
      return true;
    }, { message: opts.max != null ? rateMessage(field) : decimalMessage(field) });

const rateField = (field: string) => decimalField(field, { min: 0, max: 1 });
const moneyField = (field: string) => decimalField(field, { min: 0 });
const isoDate = (field: string) =>
  z.coerce.date({ required_error: `${field} is required`, invalid_type_error: `${field} must be a valid date` });

export const idParamSchema = z.object({
  id: z.string().min(1, { message: 'id is required' }),
});

const balloonSchema = z.object({
  dueDate: isoDate('Balloon due date'),
  amount: moneyField('Balloon amount').optional(),
  rateOfSellingPrice: rateField('Balloon rate').optional(),
});

export const generateScheduleSchema = z.object({
  paymentPlanType: z.enum(['EQUAL_INSTALLMENTS', 'FRONT_LOADED', 'CUSTOM_BALLOON']).optional(),
  downpaymentRate: rateField('Downpayment %').optional(),
  reservationRate: rateField('Reservation deposit %').optional(),
  contractingDownpaymentRate: rateField('Contracting downpayment %').optional(),
  deliveryRate: rateField('Delivery payment %').optional(),
  frequency: z.enum(['MONTHLY', 'QUARTERLY', 'SEMI_ANNUAL', 'ANNUAL'], {
    required_error: 'Installment frequency is required',
  }),
  installmentCount: z.coerce.number().int().min(0, { message: 'Installment count must be zero or more' }),
  regularStartDate: isoDate('Regular installment start').optional(),
  balloons: z.array(balloonSchema).optional(),
  annualBalloons: z.array(balloonSchema).optional(),
  maintenanceDueDate: isoDate('Maintenance deposit due date').optional(),
  deliveryDueDate: isoDate('Delivery payment due date').optional(),
  dailyLateFeeRate: rateField('Daily late fee rate').optional(),
  replaceExisting: z.boolean().optional(),
});

const chequeDtoSchema = z.object({
  chequeNumber: z.string().min(1, { message: 'Cheque number is required' }),
  bankName: z.string().min(1, { message: 'Bank name is required' }),
  drawerName: z.string().min(1, { message: 'Drawer name is required' }),
  chequeDate: isoDate('Cheque date'),
  amount: moneyField('Cheque amount'),
  unitInstallmentId: z.string().optional(),
});

export const pdcBatchRegisterSchema = z.object({
  cheques: z.array(chequeDtoSchema).min(1, { message: 'At least one cheque is required' }),
});

export const pdcDepositSchema = z.object({
  bankAccountId: z.string().min(1, { message: 'bankAccountId is required to deposit a cheque' }),
  chequeIds: z.array(z.string().min(1)).optional(),
});

export const pdcClearSchema = z.object({
  clearanceDate: isoDate('Clearance date').optional(),
});

export const pdcBounceSchema = z.object({
  bounceReason: z.string().min(1, { message: 'Bounce reason is required' }),
});

export const pdcReplaceSchema = z.object({
  replacement: chequeDtoSchema,
});

export const pdcTransitionSchema = z.union([pdcDepositSchema, pdcClearSchema, pdcBounceSchema, pdcReplaceSchema]);

export const resaleTransferRequestSchema = z.object({
  newBuyerCustomerId: z.string().min(1, { message: 'New buyer customer id is required' }),
  currentUnitMarketValue: moneyField('Current unit market value'),
  assignmentFeeRate: rateField('Assignment fee rate').optional(),
  paymentRef: z.string().optional(),
});

export const resaleClearanceSchema = z.object({
  paymentRef: z.string().min(1, { message: 'Assignment fee payment reference is required' }),
  approvedByUserId: z.string().optional(),
});

export const cancellationSettlementSchema = z.object({
  cancellationDate: isoDate('Cancellation date').optional(),
  forfeiturePenaltyRate: rateField('Forfeiture penalty rate %').optional(),
  refundDisbursementTerms: z.enum(['HELD_UNTIL_RESALE', 'IMMEDIATE_REFUND']).optional(),
});

export const settleInstallmentSchema = z.object({
  paymentAmount: moneyField('Payment amount'),
  paymentDate: isoDate('Payment date').optional(),
  allocation: z.enum(['LATE_FEES_FIRST', 'PRINCIPAL_FIRST']).optional(),
  paymentMethod: z.enum(['CASH', 'BANK_TRANSFER', 'LINKED_PDC']).optional(),
  pdcChequeId: z.string().optional(),
  safeId: z.string().optional(),
  bankAccountId: z.string().optional(),
});

export const rentalPoolDistributionSchema = z.object({
  periodStart: isoDate('Distribution period start'),
  periodEnd: isoDate('Distribution period end'),
  grossRentCollected: moneyField('Gross rent collected'),
  operatingExpenses: moneyField('Operating expenses').optional(),
  maintenanceReserveDeduction: moneyField('Reserve deductions').optional(),
  managementFeeRate: rateField('Management fee rate').optional(),
}).refine((data) => data.periodEnd >= data.periodStart, {
  message: 'Distribution period end must be on or after period start',
  path: ['periodEnd'],
});

export type GenerateScheduleInput = z.infer<typeof generateScheduleSchema>;
export type PdcBatchRegisterInput = z.infer<typeof pdcBatchRegisterSchema>;
export type ResaleTransferRequestInput = z.infer<typeof resaleTransferRequestSchema>;
export type CancellationSettlementInput = z.infer<typeof cancellationSettlementSchema>;
export type RentalPoolDistributionInput = z.infer<typeof rentalPoolDistributionSchema>;
