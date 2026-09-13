import { z } from 'zod';

export const adjustmentLineSchema = z.object({
  itemId: z.string().uuid('Item ID must be a valid UUID'),
  locationId: z.string().uuid('Location ID must be a valid UUID').optional().nullable(),
  bookQuantity: z.number().nonnegative('Book quantity must be non-negative').optional(), // If not provided, will be fetched from system
  actualQuantity: z.number().nonnegative('Actual quantity must be non-negative'),
  unitPrice: z.number().nonnegative('Unit price must be non-negative').optional(),
  adjustmentQuantity: z.number().optional(), // Will be calculated: actualQuantity - bookQuantity
  adjustmentTotal: z.number().optional(), // Will be calculated
});

export const createAdjustmentSchema = z.object({
  branchId: z.string().uuid('Branch ID must be a valid UUID').optional().nullable(),
  description: z.string().optional(),
  serial: z.string().optional(),
  date: z.string().datetime('Date must be a valid ISO datetime'),
  hijriDate: z.string().optional(),
  warehouseId: z.string().uuid('Warehouse ID must be a valid UUID'),
  record: z.string().optional(),
  lines: z.array(adjustmentLineSchema).min(1, 'At least one line is required'),
});

export const adjustmentQuerySchema = z.object({
  branchId: z.string().uuid().optional(),
  warehouseId: z.string().uuid().optional(),
  isPosted: z.string().transform((val) => val === 'true').optional(),
  isApproved: z.string().transform((val) => val === 'true').optional(),
  isCancelled: z.string().transform((val) => val === 'true').optional(),
  fromDate: z.string().datetime().optional(),
  toDate: z.string().datetime().optional(),
  skip: z.string().transform((val) => parseInt(val, 10)).optional(),
  take: z.string().transform((val) => parseInt(val, 10)).optional(),
});

export type CreateAdjustmentInput = z.infer<typeof createAdjustmentSchema>;
export type AdjustmentLineInput = z.infer<typeof adjustmentLineSchema>;
export type AdjustmentQueryInput = z.infer<typeof adjustmentQuerySchema>;

