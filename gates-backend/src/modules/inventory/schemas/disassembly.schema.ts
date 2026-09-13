import { z } from 'zod';

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
  branchId: z.string().uuid('Branch ID must be a valid UUID').optional().nullable(),
  description: z.string().optional(),
  serial: z.string().optional(),
  date: z.string().datetime('Date must be a valid ISO datetime'),
  hijriDate: z.string().optional().nullable(),
  warehouseId: z.string().uuid('Warehouse ID must be a valid UUID'),
  toWarehouseId: z.string().uuid('Destination warehouse ID must be a valid UUID').optional().nullable(),
  costCenterId: z.string().uuid('Cost center ID must be a valid UUID').optional().nullable(),
  lines: z.array(disassemblyLineSchema).min(1, 'At least one disassembly line is required'),
});

export const disassemblyQuerySchema = z.object({
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

export type CreateDisassemblyInput = z.infer<typeof createDisassemblySchema>;
export type DisassemblyLineInput = z.infer<typeof disassemblyLineSchema>;
export type DisassemblyComponentLineInput = z.infer<typeof disassemblyComponentLineSchema>;
export type DisassemblyQueryInput = z.infer<typeof disassemblyQuerySchema>;

