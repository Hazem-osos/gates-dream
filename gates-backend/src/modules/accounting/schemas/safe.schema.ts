import { z } from 'zod';

export const createSafeSchema = z.object({
  code: z.string().optional(),
  arabicName: z.string().min(1, 'Arabic name is required'),
  englishName: z.string().optional(),
  currencyCode: z.string().min(1, 'Currency code is required'),
  parentAccountId: z.string().optional(),
});

export const updateSafeSchema = createSafeSchema.partial().extend({
  isActive: z.boolean().optional(),
});

export const safeQuerySchema = z.object({
  page: z.string().optional().transform((val) => (val ? parseInt(val, 10) : 1)),
  limit: z.string().optional().transform((val) => (val ? parseInt(val, 10) : 50)),
  search: z.string().optional(),
  isActive: z
    .string()
    .optional()
    .transform((val) => (val === undefined ? undefined : val === 'true')),
});

export type CreateSafeInput = z.infer<typeof createSafeSchema>;
export type UpdateSafeInput = z.infer<typeof updateSafeSchema>;
export type SafeQueryInput = z.infer<typeof safeQuerySchema>;

