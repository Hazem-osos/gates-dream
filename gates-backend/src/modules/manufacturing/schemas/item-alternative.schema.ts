import { z } from 'zod';

export const itemAlternativeLineSchema = z.object({
  alternativeItemId: z.string().uuid(),
  quantity: z.coerce.number().positive(),
  lineOrder: z.coerce.number().int().positive().optional(),
});

export const saveItemAlternativesSchema = z.object({
  lines: z.array(itemAlternativeLineSchema),
});

export const itemAlternativesBatchQuerySchema = z.object({
  itemIds: z.string().min(1),
});
