import { z } from 'zod';

export const otherAdjustmentSourceSchema = z.object({
  source: z.string().min(1, 'Source is required'),
  percentage: z.number().min(0).max(100, 'Percentage must be between 0 and 100'),
});

export const otherAdjustmentLineSchema = z.object({
  itemId: z.string().uuid('Item ID must be a valid UUID'),
  locationId: z.string().uuid('Location ID must be a valid UUID').optional().nullable(),
  quantity: z.number().positive('Quantity must be positive'),
  adjustmentType: z.enum(['addition', 'discount'], {
    errorMap: () => ({ message: 'Adjustment type must be either addition or discount' }),
  }),
  unitPrice: z.number().nonnegative('Unit price must be non-negative').optional(),
  total: z.number().nonnegative('Total must be non-negative').optional(),
  sources: z.array(otherAdjustmentSourceSchema).optional(),
});

export const createOtherAdjustmentSchema = z.object({
  branchId: z.string().uuid('Branch ID must be a valid UUID').optional().nullable(),
  description: z.string().optional(),
  serial: z.string().optional(),
  date: z.string().datetime('Date must be a valid ISO datetime'),
  warehouseId: z.string().uuid('Warehouse ID must be a valid UUID'),
  lines: z.array(otherAdjustmentLineSchema).min(1, 'At least one line is required'),
});

export const otherAdjustmentQuerySchema = z.object({
  branchId: z.string().uuid().optional(),
  warehouseId: z.string().uuid().optional(),
  adjustmentType: z.enum(['addition', 'discount']).optional(),
  isPosted: z.string().transform((val) => val === 'true').optional(),
  isApproved: z.string().transform((val) => val === 'true').optional(),
  isCancelled: z.string().transform((val) => val === 'true').optional(),
  fromDate: z.string().datetime().optional(),
  toDate: z.string().datetime().optional(),
  skip: z.string().transform((val) => parseInt(val, 10)).optional(),
  take: z.string().transform((val) => parseInt(val, 10)).optional(),
});

export type CreateOtherAdjustmentInput = z.infer<typeof createOtherAdjustmentSchema>;
export type OtherAdjustmentLineInput = z.infer<typeof otherAdjustmentLineSchema>;
export type OtherAdjustmentSourceInput = z.infer<typeof otherAdjustmentSourceSchema>;
export type OtherAdjustmentQueryInput = z.infer<typeof otherAdjustmentQuerySchema>;

