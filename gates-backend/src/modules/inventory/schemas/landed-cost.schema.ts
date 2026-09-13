import { z } from 'zod';

export const createLandedCostAllocationSchema = z.object({
  branchId: z.string().uuid('Branch ID must be a valid UUID').optional().nullable(),
  invoiceId: z.string().uuid('Invoice ID must be a valid UUID'),
  description: z.string().optional(),
  serial: z.string().optional(),
  date: z.string().datetime('Date must be a valid ISO datetime'),
  totalAmount: z.number().positive('Total amount must be positive'),
  expenseAccountId: z.string().uuid('Expense account ID must be a valid UUID'),
});

export const landedCostAllocationQuerySchema = z.object({
  branchId: z.string().uuid().optional(),
  invoiceId: z.string().uuid().optional(),
  isPosted: z.string().transform((val) => val === 'true').optional(),
  isCancelled: z.string().transform((val) => val === 'true').optional(),
  skip: z.string().transform((val) => parseInt(val, 10)).optional(),
  take: z.string().transform((val) => parseInt(val, 10)).optional(),
});

export type CreateLandedCostAllocationInput = z.infer<typeof createLandedCostAllocationSchema>;
export type LandedCostAllocationQueryInput = z.infer<typeof landedCostAllocationQuerySchema>;
