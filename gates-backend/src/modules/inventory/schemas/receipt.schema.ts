import { z } from 'zod';

const emptyToNull = (value: unknown) => (value === '' || value === undefined ? null : value);
const optionalUuid = z.preprocess(emptyToNull, z.string().uuid().optional().nullable());
const isoDateTime = z.preprocess((value) => {
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value.trim())) {
    return new Date(`${value.trim()}T00:00:00.000Z`).toISOString();
  }
  return value;
}, z.string().datetime('Date must be a valid ISO datetime'));

export const receiptLineSchema = z.object({
  itemId: z.string().uuid('Item ID must be a valid UUID'),
  locationId: optionalUuid,
  quantity: z.coerce.number().positive('Quantity must be positive'),
  unitPrice: z.coerce.number().nonnegative('Unit price must be non-negative').optional(),
  total: z.coerce.number().nonnegative('Total must be non-negative').optional(),
});

export const createReceiptSchema = z.object({
  branchId: optionalUuid,
  description: z.string().optional(),
  serial: z.string().optional(),
  date: isoDateTime,
  hijriDate: z.string().optional(),
  warehouseId: z.string().uuid('Warehouse ID must be a valid UUID'),
  supplierId: optionalUuid,
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
