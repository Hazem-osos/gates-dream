import { z } from 'zod';

export const receiptLineSchema = z.object({
  itemId: z.string().uuid('Item ID must be a valid UUID'),
  locationId: z.string().uuid('Location ID must be a valid UUID').optional().nullable(),
  quantity: z.number().positive('Quantity must be positive'),
  unitPrice: z.number().nonnegative('Unit price must be non-negative').optional(),
  total: z.number().nonnegative('Total must be non-negative').optional(),
});

export const createReceiptSchema = z.object({
  branchId: z.string().uuid('Branch ID must be a valid UUID').optional().nullable(),
  description: z.string().optional(),
  serial: z.string().optional(),
  date: z.string().datetime('Date must be a valid ISO datetime'),
  hijriDate: z.string().optional(),
  warehouseId: z.string().uuid('Warehouse ID must be a valid UUID'),
  record: z.string().optional(),
  lines: z.array(receiptLineSchema).min(1, 'At least one line is required'),
});

const queryFlag = z
  .union([z.boolean(), z.enum(['true', 'false', '1', '0'])])
  .optional()
  .transform((val) => {
    if (val === undefined) return undefined;
    if (typeof val === 'boolean') return val;
    return val === 'true' || val === '1';
  });

export const receiptQuerySchema = z.object({
  branchId: z.string().uuid().optional(),
  warehouseId: z.string().uuid().optional(),
  isPosted: queryFlag,
  isApproved: queryFlag,
  isCancelled: queryFlag,
  fromDate: z.string().datetime().optional(),
  toDate: z.string().datetime().optional(),
  search: z.string().optional(),
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(200).optional(),
  skip: z.coerce.number().int().min(0).optional(),
  take: z.coerce.number().int().min(1).max(200).optional(),
});

export type CreateReceiptInput = z.infer<typeof createReceiptSchema>;
export type ReceiptLineInput = z.infer<typeof receiptLineSchema>;
export type ReceiptQueryInput = z.infer<typeof receiptQuerySchema>;

