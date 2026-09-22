import { z } from 'zod';

export const transferLineSchema = z.object({
  itemId: z.string().uuid('Item ID must be a valid UUID'),
  fromLocationId: z.string().uuid('From location ID must be a valid UUID').optional().nullable(),
  toLocationId: z.string().uuid('To location ID must be a valid UUID').optional().nullable(),
  quantity: z.number().positive('Quantity must be positive'),
  unitPrice: z.number().nonnegative('Unit price must be non-negative').optional(),
  total: z.number().nonnegative('Total must be non-negative').optional(),
});

const transferDateSchema = z
  .string()
  .min(1, 'Date is required')
  .transform((value, ctx) => {
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Date must be a valid ISO datetime' });
      return z.NEVER;
    }
    return parsed.toISOString();
  });

export const createTransferSchema = z
  .object({
    branchId: z.string().uuid('Branch ID must be a valid UUID').optional().nullable(),
    description: z.string().optional(),
    serial: z.string().optional(),
    serialNumber: z.string().optional(),
    date: transferDateSchema,
    hijriDate: z.string().optional(),
    fromWarehouseId: z.string().uuid('From warehouse ID must be a valid UUID'),
    toWarehouseId: z.string().uuid('To warehouse ID must be a valid UUID'),
    fromCostCenterId: z.string().uuid('From cost center ID must be a valid UUID').optional().nullable(),
    toCostCenterId: z.string().uuid('To cost center ID must be a valid UUID').optional().nullable(),
    lines: z.array(transferLineSchema).min(1, 'At least one line is required'),
  })
  .transform((data) => ({
    ...data,
    serial: data.serial || data.serialNumber,
  }));

const queryFlag = z
  .union([z.boolean(), z.enum(['true', 'false', '1', '0'])])
  .optional()
  .transform((val) => {
    if (val === undefined) return undefined;
    if (typeof val === 'boolean') return val;
    return val === 'true' || val === '1';
  });

export const transferQuerySchema = z.object({
  branchId: z.string().uuid().optional(),
  fromWarehouseId: z.string().uuid().optional(),
  toWarehouseId: z.string().uuid().optional(),
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

export type CreateTransferInput = z.infer<typeof createTransferSchema>;
export type TransferLineInput = z.infer<typeof transferLineSchema>;
export type TransferQueryInput = z.infer<typeof transferQuerySchema>;

