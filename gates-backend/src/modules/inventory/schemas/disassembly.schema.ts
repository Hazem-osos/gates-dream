import { z } from 'zod';

const emptyToNull = (value: unknown) => (value === '' || value === undefined ? null : value);
const optionalUuid = z.preprocess(emptyToNull, z.string().uuid().optional().nullable());

export const disassemblyComponentLineSchema = z.object({
  componentItemId: z.string().uuid('Component item ID must be a valid UUID'),
  quantity: z.number().positive('Quantity must be positive'), // Quantity per disassembled item
  unitPrice: z.number().nonnegative('Unit price must be non-negative').optional(),
  total: z.number().nonnegative('Total must be non-negative').optional(),
});

export const disassemblyLineSchema = z.object({
  disassembledItemId: z.string().uuid('Disassembled item ID must be a valid UUID'),
  disassembledQuantity: z.number().positive('Disassembled quantity must be positive'),
  disassembledUnitPrice: z.number().nonnegative('Disassembled unit price must be non-negative').optional(),
  disassembledTotal: z.number().nonnegative('Disassembled total must be non-negative').optional(),
  components: z.array(disassemblyComponentLineSchema).min(1, 'At least one component is required'),
});

export const createDisassemblySchema = z.object({
  branchId: optionalUuid,
  description: z.string().optional(),
  serial: z.string().optional(),
  date: z.string().datetime('Date must be a valid ISO datetime'),
  hijriDate: z.string().optional().nullable(),
  warehouseId: z.string().uuid('Warehouse ID must be a valid UUID'),
  toWarehouseId: optionalUuid,
  costCenterId: optionalUuid,
  lines: z.array(disassemblyLineSchema).min(1, 'At least one disassembly line is required'),
});

const optionalBool = z
  .union([z.boolean(), z.string()])
  .optional()
  .transform((val) => {
    if (val === undefined) return undefined;
    if (typeof val === 'boolean') return val;
    return val === 'true';
  });

export const disassemblyQuerySchema = z.object({
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

export type CreateDisassemblyInput = z.infer<typeof createDisassemblySchema>;
export type DisassemblyLineInput = z.infer<typeof disassemblyLineSchema>;
export type DisassemblyComponentLineInput = z.infer<typeof disassemblyComponentLineSchema>;
export type DisassemblyQueryInput = z.infer<typeof disassemblyQuerySchema>;

