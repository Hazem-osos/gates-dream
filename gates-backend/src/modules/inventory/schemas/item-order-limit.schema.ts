import { z } from 'zod';

export const itemOrderLimitLineSchema = z.object({
  id: z.string().uuid().optional(),
  itemId: z.string().uuid(),
  orderLimit: z.number().nonnegative().optional().default(0),
  lowerLimit: z.number().nonnegative().optional().nullable(),
  upperLimit: z.number().nonnegative().optional().nullable(),
});

export const createItemOrderLimitSchema = z.object({
  code: z.string().optional().nullable(),
  warehouseId: z.string().uuid('Warehouse is required'),
  description: z.string().optional().nullable(),
  lines: z.array(itemOrderLimitLineSchema).optional(),
});

export const updateItemOrderLimitSchema = createItemOrderLimitSchema.partial().extend({
  warehouseId: z.string().uuid().optional(),
  isActive: z.boolean().optional(),
  lines: z.array(itemOrderLimitLineSchema).optional(),
});

export const itemOrderLimitQuerySchema = z.object({
  page: z.string().optional().transform((val) => (val ? parseInt(val, 10) : 1)),
  limit: z.string().optional().transform((val) => (val ? parseInt(val, 10) : 50)),
  search: z.string().optional(),
  warehouseId: z.string().uuid().optional(),
  isActive: z
    .string()
    .optional()
    .transform((val) => (val === undefined ? undefined : val === 'true')),
});

export type CreateItemOrderLimitInput = z.infer<typeof createItemOrderLimitSchema>;
export type UpdateItemOrderLimitInput = z.infer<typeof updateItemOrderLimitSchema>;
export type ItemOrderLimitLineInput = z.infer<typeof itemOrderLimitLineSchema>;
