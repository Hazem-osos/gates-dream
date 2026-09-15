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

const optionalBool = z
  .union([z.boolean(), z.string()])
  .optional()
  .transform((val) => (val === undefined ? undefined : val === true || val === 'true'));

const optionalInt = z
  .union([z.number(), z.string()])
  .optional()
  .transform((val) => {
    if (val === undefined || val === '') return undefined;
    const n = typeof val === 'number' ? val : Number.parseInt(val, 10);
    return Number.isFinite(n) ? n : undefined;
  });

export const openingStockQuerySchema = z.object({
  branchId: z.string().uuid().optional(),
  isPosted: optionalBool,
  isApproved: optionalBool,
  isCancelled: optionalBool,
  fromDate: z.string().optional(),
  toDate: z.string().optional(),
  search: z.string().optional(),
  skip: optionalInt,
  take: optionalInt,
});

export type CreateOpeningStockInput = z.infer<typeof createOpeningStockSchema>;
export type OpeningStockLineInput = z.infer<typeof openingStockLineSchema>;
export type OpeningStockQueryInput = z.infer<typeof openingStockQuerySchema>;

