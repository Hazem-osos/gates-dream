import { z } from 'zod';

export const assemblyComponentLineSchema = z.object({
  componentItemId: z.string().uuid('Component item ID must be a valid UUID'),
  quantity: z.number().positive('Quantity must be positive'),
  unitPrice: z.number().nonnegative('Unit price must be non-negative').optional(),
  total: z.number().nonnegative('Total must be non-negative').optional(),
});

export const assemblyLineSchema = z.object({
  assembledItemId: z.string().uuid('Assembled item ID must be a valid UUID'),
  assembledQuantity: z.number().positive('Assembled quantity must be positive'),
  assembledUnitPrice: z.number().nonnegative('Assembled unit price must be non-negative').optional(),
  assembledTotal: z.number().nonnegative('Assembled total must be non-negative').optional(),
  components: z.array(assemblyComponentLineSchema).min(1, 'At least one component is required'),
});

export const createAssemblySchema = z.object({
  branchId: z.string().uuid('Branch ID must be a valid UUID').optional().nullable(),
  description: z.string().optional(),
  serial: z.string().optional(),
  date: z.string().datetime('Date must be a valid ISO datetime'),
  hijriDate: z.string().optional().nullable(),
  warehouseId: z.string().uuid('Warehouse ID must be a valid UUID'),
  toWarehouseId: z.string().uuid('Destination warehouse ID must be a valid UUID').optional().nullable(),
  costCenterId: z.string().uuid('Cost center ID must be a valid UUID').optional().nullable(),
  lines: z.array(assemblyLineSchema).min(1, 'At least one assembly line is required'),
});

export const assemblyQuerySchema = z.object({
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

export type CreateAssemblyInput = z.infer<typeof createAssemblySchema>;
export type AssemblyLineInput = z.infer<typeof assemblyLineSchema>;
export type AssemblyComponentLineInput = z.infer<typeof assemblyComponentLineSchema>;
export type AssemblyQueryInput = z.infer<typeof assemblyQuerySchema>;

