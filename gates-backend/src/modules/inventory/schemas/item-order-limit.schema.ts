import { z } from 'zod';

const asBool = z
  .union([z.boolean(), z.string()])
  .optional()
  .transform((val) => (val === undefined ? undefined : val === true || val === 'true'));

const asPage = z
  .union([z.string(), z.number()])
  .optional()
  .transform((val) => {
    const n = typeof val === 'number' ? val : val ? parseInt(val, 10) : 1;
    return Number.isFinite(n) && n > 0 ? n : 1;
  });

const asLimit = z
  .union([z.string(), z.number()])
  .optional()
  .transform((val) => {
    const n = typeof val === 'number' ? val : val ? parseInt(val, 10) : 50;
    return Number.isFinite(n) && n > 0 ? n : 50;
  });

export const itemOrderLimitLineSchema = z.object({
  id: z.string().min(1).optional(),
  itemId: z.string().min(1),
  orderLimit: z.number().nonnegative().optional().default(0),
  lowerLimit: z.number().nonnegative().optional().nullable(),
  upperLimit: z.number().nonnegative().optional().nullable(),
});

export const createItemOrderLimitSchema = z.object({
  code: z.string().optional().nullable(),
  warehouseId: z.string().min(1, 'يرجى اختيار المخزن'),
  description: z.string().optional().nullable(),
  lines: z.array(itemOrderLimitLineSchema).optional(),
});

export const updateItemOrderLimitSchema = createItemOrderLimitSchema.partial().extend({
  warehouseId: z.string().min(1).optional(),
  isActive: z.boolean().optional(),
  lines: z.array(itemOrderLimitLineSchema).optional(),
});

export const itemOrderLimitQuerySchema = z.object({
  page: asPage,
  limit: asLimit,
  search: z.string().optional(),
  warehouseId: z.string().min(1).optional(),
  isActive: asBool,
});

export type CreateItemOrderLimitInput = z.infer<typeof createItemOrderLimitSchema>;
export type UpdateItemOrderLimitInput = z.infer<typeof updateItemOrderLimitSchema>;
export type ItemOrderLimitLineInput = z.infer<typeof itemOrderLimitLineSchema>;
