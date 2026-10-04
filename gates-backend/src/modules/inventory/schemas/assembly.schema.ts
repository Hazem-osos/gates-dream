import { z } from 'zod';

const emptyToNull = (value: unknown) => (value === '' || value === undefined ? null : value);
const optionalUuid = z.preprocess(emptyToNull, z.string().uuid().optional().nullable());

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
  branchId: optionalUuid,
  description: z.string().optional(),
  serial: z.string().optional(),
  date: z.string().datetime('Date must be a valid ISO datetime'),
  hijriDate: z.string().optional().nullable(),
  warehouseId: z.string().uuid('Warehouse ID must be a valid UUID'),
  toWarehouseId: optionalUuid,
  costCenterId: optionalUuid,
  lines: z.array(assemblyLineSchema).min(1, 'At least one assembly line is required'),
});

const optionalBool = z
  .union([z.boolean(), z.string()])
  .optional()
  .transform((val) => {
    if (val === undefined) return undefined;
    if (typeof val === 'boolean') return val;
    return val === 'true';
  });

export const assemblyQuerySchema = z.object({
  branchId: z.string().uuid().optional(),
  warehouseId: z.string().uuid().optional(),
  isPosted: optionalBool,
  isApproved: optionalBool,
  isCancelled: optionalBool,
  fromDate: z.string().optional(),
  toDate: z.string().optional(),
  skip: z.coerce.number().int().min(0).optional(),
  take: z.coerce.number().int().min(1).max(200).optional(),
});

export type CreateAssemblyInput = z.infer<typeof createAssemblySchema>;
export type AssemblyLineInput = z.infer<typeof assemblyLineSchema>;
export type AssemblyComponentLineInput = z.infer<typeof assemblyComponentLineSchema>;
export type AssemblyQueryInput = z.infer<typeof assemblyQuerySchema>;

