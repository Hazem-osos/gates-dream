import { z } from 'zod';

const cashLineSchema = z.object({
  accountId: z.string().uuid(),
  description: z.string().optional(),
  amount: z.number().positive(),
  currencyCode: z.string().min(3).max(10).optional(),
  currencyId: z.string().uuid().optional(),
  exchangeRate: z.number().positive().optional(),
  baseAmount: z.number().nonnegative().optional(),
  costCenterId: z.string().uuid().optional().nullable(),
  entrySide: z.enum(['DEBIT', 'CREDIT']).optional(),
  isTiedToInvoice: z.boolean().optional(),
  invoiceId: z.string().uuid().optional().nullable(),
});

const allocationSchema = z.object({
  invoiceId: z.string().uuid(),
  allocatedAmount: z.number().positive(),
});

export const createCashTransactionSchema = z.object({
  transactionKind: z.enum(['RECEIPT', 'PAYMENT']),
  voucherNumber: z.string().max(16).optional(),
  date: z.coerce.date(),
  hijriDate: z.string().max(32).optional(),
  description: z.string().optional(),
  amount: z.number().positive(),
  currencyCode: z.string().min(3).max(10),
  customerId: z.string().uuid().optional(),
  supplierId: z.string().uuid().optional(),
  offsetAccountId: z.string().uuid().optional(),
  safeId: z.string().uuid().optional(),
  bankAccountId: z.string().uuid().optional(),
  exchangeRate: z.number().positive().optional(),
  isRecurring: z.boolean().optional(),
  documentRole: z.enum(['ORDER', 'VOUCHER']).optional(),
  departmentId: z.string().uuid().optional(),
  sourceOrderId: z.string().uuid().optional(),
  paymentOrderCode: z.string().max(40).optional(),
  paymentOrderNumber: z.string().max(40).optional(),
  receiptOrderCode: z.string().max(40).optional(),
  receiptOrderNumber: z.string().max(40).optional(),
  bankReference: z.string().max(80).optional(),
  referenceNumber: z.string().max(80).optional(),
  valueDate: z.coerce.date().optional(),
  lines: z.array(cashLineSchema).optional(),
  allocations: z.array(allocationSchema).optional(),
});

export const updateCashTransactionSchema = createCashTransactionSchema.extend({
  expectedVersion: z.number().int().nonnegative(),
});

export const expectedVersionBodySchema = z
  .object({
    expectedVersion: z.number().int().nonnegative().optional(),
  })
  .optional()
  .default({});

export const listCashTransactionsQuerySchema = z.object({
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().max(200).optional(),
  isPosted: z
    .enum(['true', 'false'])
    .optional()
    .transform((v) => (v === undefined ? undefined : v === 'true')),
  isCancelled: z
    .enum(['true', 'false'])
    .optional()
    .transform((v) => (v === undefined ? undefined : v === 'true')),
  isRecurring: z
    .enum(['true', 'false'])
    .optional()
    .transform((v) => (v === undefined ? undefined : v === 'true')),
  transactionKind: z.enum(['RECEIPT', 'PAYMENT']).optional(),
  documentRole: z.enum(['ORDER', 'VOUCHER']).optional(),
  departmentId: z.string().uuid().optional(),
  fundType: z.enum(['CASHBOX', 'BANK_ACCOUNT']).optional(),
  voucherNumber: z.string().max(40).optional(),
  search: z.string().max(80).optional(),
  code: z.string().max(40).optional(),
  number: z.string().max(40).optional(),
  sortBy: z.enum(['number', 'voucherNumber', 'date', 'amount']).optional(),
  sortDir: z.enum(['asc', 'desc']).optional(),
  executionStatus: z.enum(['PENDING', 'COMPLETED', 'CANCELLED']).optional(),
});

export const createInwardChequeSchema = z.object({
  chequeNumber: z.string().min(1).max(50),
  bankName: z.string().optional(),
  dueDate: z.coerce.date().optional(),
  amount: z.number().positive(),
  currencyCode: z.string().min(3).max(10),
  customerId: z.string().uuid(),
  description: z.string().optional(),
});

export const updateChequeHeaderSchema = z.object({
  chequeNumber: z.string().min(1).max(50).optional(),
  bankName: z.string().optional().nullable(),
  dueDate: z.coerce.date().optional().nullable(),
  description: z.string().optional().nullable(),
});

export const clearInwardChequeSchema = z.object({
  bankAccountId: z.string().uuid(),
});

/** L2 fix (Item 41): endorse (تظهير) an inward cheque to a supplier. */
export const endorseInwardChequeSchema = z.object({
  supplierId: z.string().uuid(),
  notes: z.string().max(500).optional(),
});

export const CHEQUE_DIRECTIONS = ['INWARD', 'OUTWARD'] as const;
export const CHEQUE_STATUSES = [
  'UNDER_HAND',
  'SENT_TO_BANK',
  'COLLECTED',
  'ENDORSED',
  'BOUNCED',
  'RETURNED_TO_DRAWER',
  'CANCELLED',
] as const;

export const listChequesQuerySchema = z.object({
  direction: z.enum(CHEQUE_DIRECTIONS).optional(),
  status: z.enum(CHEQUE_STATUSES).optional(),
  partyId: z.string().uuid().optional(),
  dateFrom: z.coerce.date().optional(),
  dateTo: z.coerce.date().optional(),
  search: z.string().max(80).optional(),
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().max(200).optional(),
});

export const chequeStatsQuerySchema = z.object({
  direction: z.enum(CHEQUE_DIRECTIONS).optional(),
});

export const createOutwardChequeSchema = z.object({
  chequeNumber: z.string().min(1).max(50),
  bankName: z.string().optional(),
  dueDate: z.coerce.date().optional(),
  amount: z.number().positive(),
  currencyCode: z.string().min(3).max(10),
  supplierId: z.string().uuid(),
  bankAccountId: z.string().uuid(),
  description: z.string().optional(),
});
