import { z } from 'zod';

export const openingStockLineSchema = z.object({
  itemId: z.string().uuid('Item ID must be a valid UUID'),
  warehouseId: z.string().uuid('Warehouse ID must be a valid UUID'),
  locationId: z.string().uuid('Location ID must be a valid UUID').optional().nullable(),
  quantity: z.number().positive('Quantity must be positive'),
  unitPrice: z.number().nonnegative('Unit price must be non-negative'),
  total: z.number().nonnegative('Total must be non-negative'),
});

export const createOpeningStockSchema = z.object({
  branchId: z.string().uuid('Branch ID must be a valid UUID').optional().nullable(),
  description: z.string().optional(),
  serial: z.string().optional(),
  date: z.string().datetime('Date must be a valid ISO datetime'),
  lines: z.array(openingStockLineSchema).min(1, 'At least one line is required'),
});

export const openingStockQuerySchema = z.object({
  branchId: z.string().uuid().optional(),
  isPosted: z.string().transform((val) => val === 'true').optional(),
  isApproved: z.string().transform((val) => val === 'true').optional(),
  isCancelled: z.string().transform((val) => val === 'true').optional(),
  fromDate: z.string().datetime().optional(),
  toDate: z.string().datetime().optional(),
  skip: z.string().transform((val) => parseInt(val, 10)).optional(),
  take: z.string().transform((val) => parseInt(val, 10)).optional(),
});

export type CreateOpeningStockInput = z.infer<typeof createOpeningStockSchema>;
export type OpeningStockLineInput = z.infer<typeof openingStockLineSchema>;
export type OpeningStockQueryInput = z.infer<typeof openingStockQuerySchema>;

