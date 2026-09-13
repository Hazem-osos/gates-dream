import { z } from 'zod';

export const createItemUnitSchema = z.object({
  itemId: z.string().uuid('Item ID must be a valid UUID'),
  unitId: z.string().uuid('Unit ID must be a valid UUID'),
  conversionFactor: z.number().positive('Conversion factor must be greater than 0'),
  isFactorFixed: z.boolean().optional(),
  isBaseUnit: z.boolean().optional(),
});

export const updateItemUnitSchema = z.object({
  conversionFactor: z.number().positive('Conversion factor must be greater than 0').optional(),
  isFactorFixed: z.boolean().optional(),
  isBaseUnit: z.boolean().optional(),
});

export const itemUnitQuerySchema = z.object({
  page: z.string().optional().transform((val) => (val ? parseInt(val, 10) : 1)),
  limit: z.string().optional().transform((val) => (val ? parseInt(val, 10) : 50)),
  search: z.string().optional(),
  itemId: z.string().uuid().optional(),
  unitId: z.string().uuid().optional(),
  isBaseUnit: z.string().optional().transform((val) => val === 'true'),
});

export type CreateItemUnitInput = z.infer<typeof createItemUnitSchema>;
export type UpdateItemUnitInput = z.infer<typeof updateItemUnitSchema>;
export type ItemUnitQueryInput = z.infer<typeof itemUnitQuerySchema>;
