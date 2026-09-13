import { z } from 'zod';

export const createTreasuryReceiptSchema = z.object({
  branchId: z.string().uuid().optional().nullable(),
  serial: z.string().optional(),
  voucherNumber: z.string().optional(),
  date: z.string().transform((val) => new Date(val)),
  hijriDate: z.string().optional(),
  description: z.string().optional(),
  receiptType: z.enum(['cash', 'bank', 'safe', 'party']),
  // Source (where money comes from)
  customerId: z.string().uuid().optional().nullable(),
  supplierId: z.string().uuid().optional().nullable(),
  accountId: z.string().uuid().optional().nullable(),
  // Destination (where money goes)
  safeId: z.string().uuid().optional().nullable(),
  bankAccountId: z.string().uuid().optional().nullable(),
  // Amounts
  amount: z.number().positive('Amount must be positive'),
  currencyCode: z.string().min(1, 'Currency code is required'),
  exchangeRate: z.number().positive().optional(),
});

export const updateTreasuryReceiptSchema = createTreasuryReceiptSchema.partial();

export const treasuryReceiptQuerySchema = z.object({
  page: z.string().optional().transform((val) => (val ? parseInt(val, 10) : 1)),
  limit: z.string().optional().transform((val) => (val ? parseInt(val, 10) : 50)),
  startDate: z.string().optional().transform((val) => (val ? new Date(val) : undefined)),
  endDate: z.string().optional().transform((val) => (val ? new Date(val) : undefined)),
  receiptType: z.enum(['cash', 'bank', 'safe', 'party']).optional(),
  isPosted: z.string().optional().transform((val) => val === 'true'),
});

export type CreateTreasuryReceiptInput = z.infer<typeof createTreasuryReceiptSchema>;
export type UpdateTreasuryReceiptInput = z.infer<typeof updateTreasuryReceiptSchema>;
export type TreasuryReceiptQueryInput = z.infer<typeof treasuryReceiptQuerySchema>;

