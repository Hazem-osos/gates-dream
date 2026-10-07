import { z } from 'zod';

const workOrderLineSchema = z.object({
  itemId: z.string().uuid(),
  plannedQuantity: z.coerce.number().nonnegative(),
  completedQuantity: z.coerce.number().nonnegative().optional().default(0),
  unit: z.string().max(50).optional().nullable(),
  lineDescription: z.string().max(4000).optional().nullable(),
  imageUrl: z.string().max(2_000_000).optional().nullable(),
  lineOrder: z.coerce.number().int().positive().optional(),
});

export const saveManufacturingWorkOrderSchema = z.object({
  orderNumber: z.string().max(50).optional(),
  bomId: z.string().uuid().optional().nullable(),
  salesOrderInvoiceId: z.string().uuid().optional().nullable(),
  description: z.string().max(500).optional().nullable(),
  workDate: z.string().min(1),
  modelQuantity: z.coerce.number().positive(),
  status: z
    .enum(['CONFIRMED', 'IN_PROGRESS', 'COMPLETED', 'OPEN', 'CLOSED', 'CANCELLED'])
    .optional(),
  processMetadata: z.record(z.unknown()).optional().nullable(),
  lines: z.array(workOrderLineSchema).min(1),
});

export type SaveManufacturingWorkOrderInput = z.infer<typeof saveManufacturingWorkOrderSchema>;
