import { z } from 'zod';

export const stocktakingLineSchema = z.object({
  itemId: z.string().uuid('Item ID must be a valid UUID'),
  warehouseId: z.string().uuid('Warehouse ID must be a valid UUID'),
  locationId: z.string().uuid('Location ID must be a valid UUID').optional().nullable(),
  unitId: z.string().uuid('Unit ID must be a valid UUID').optional().nullable(),
  bookQuantity: z.number().nonnegative('Book quantity must be non-negative').optional(),
  actualQuantity: z.number().nonnegative('Actual quantity must be non-negative'),
  unitPrice: z.number().nonnegative('Unit price must be non-negative'),
  shortageQuantity: z.number().nonnegative().optional(),
  increaseQuantity: z.number().nonnegative().optional(),
  shortageTotal: z.number().nonnegative().optional(),
  increaseTotal: z.number().nonnegative().optional(),
});

export const createStocktakingSchema = z.object({
  branchId: z.string().uuid('Branch ID must be a valid UUID').optional().nullable(),
  description: z.string().optional(),
  serial: z.string().optional(),
  date: z.string().datetime('Date must be a valid ISO datetime'),
  warehouseId: z.string().uuid('Warehouse ID must be a valid UUID'),
  lines: z.array(stocktakingLineSchema).min(1, 'At least one line is required'),
});

export const stocktakingQuerySchema = z.object({
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

export type CreateStocktakingInput = z.infer<typeof createStocktakingSchema>;
export type StocktakingLineInput = z.infer<typeof stocktakingLineSchema>;
export type StocktakingQueryInput = z.infer<typeof stocktakingQuerySchema>;

