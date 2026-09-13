import { z } from 'zod';

export const transferLineSchema = z.object({
  itemId: z.string().uuid('Item ID must be a valid UUID'),
  fromLocationId: z.string().uuid('From location ID must be a valid UUID').optional().nullable(),
  toLocationId: z.string().uuid('To location ID must be a valid UUID').optional().nullable(),
  quantity: z.number().positive('Quantity must be positive'),
  unitPrice: z.number().nonnegative('Unit price must be non-negative').optional(),
  total: z.number().nonnegative('Total must be non-negative').optional(),
});

export const createTransferSchema = z.object({
  branchId: z.string().uuid('Branch ID must be a valid UUID').optional().nullable(),
  description: z.string().optional(),
  serial: z.string().optional(),
  date: z.string().datetime('Date must be a valid ISO datetime'),
  hijriDate: z.string().optional(),
  fromWarehouseId: z.string().uuid('From warehouse ID must be a valid UUID'),
  toWarehouseId: z.string().uuid('To warehouse ID must be a valid UUID'),
  fromCostCenterId: z.string().uuid('From cost center ID must be a valid UUID').optional().nullable(),
  toCostCenterId: z.string().uuid('To cost center ID must be a valid UUID').optional().nullable(),
  lines: z.array(transferLineSchema).min(1, 'At least one line is required'),
});

export const transferQuerySchema = z.object({
  branchId: z.string().uuid().optional(),
  fromWarehouseId: z.string().uuid().optional(),
  toWarehouseId: z.string().uuid().optional(),
  isPosted: z.string().transform((val) => val === 'true').optional(),
  isApproved: z.string().transform((val) => val === 'true').optional(),
  isCancelled: z.string().transform((val) => val === 'true').optional(),
  fromDate: z.string().datetime().optional(),
  toDate: z.string().datetime().optional(),
  skip: z.string().transform((val) => parseInt(val, 10)).optional(),
  take: z.string().transform((val) => parseInt(val, 10)).optional(),
});

export type CreateTransferInput = z.infer<typeof createTransferSchema>;
export type TransferLineInput = z.infer<typeof transferLineSchema>;
export type TransferQueryInput = z.infer<typeof transferQuerySchema>;

