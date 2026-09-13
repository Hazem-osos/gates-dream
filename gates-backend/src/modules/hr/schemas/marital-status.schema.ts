import { z } from 'zod';

export const createMaritalStatusSchema = z.object({
  code: z.string().optional(),
  arabicName: z.string().min(1, 'Arabic name is required'),
  englishName: z.string().optional(),
});

export const updateMaritalStatusSchema = createMaritalStatusSchema.partial().extend({
  isActive: z.boolean().optional(),
});

export const maritalStatusQuerySchema = z.object({
  page: z.string().optional().transform((val) => (val ? parseInt(val, 10) : 1)),
  limit: z.string().optional().transform((val) => (val ? parseInt(val, 10) : 50)),
  search: z.string().optional(),
  isActive: z
    .string()
    .optional()
    .transform((val) => (val === undefined ? undefined : val === 'true')),
});

export type CreateMaritalStatusInput = z.infer<typeof createMaritalStatusSchema>;
export type UpdateMaritalStatusInput = z.infer<typeof updateMaritalStatusSchema>;
export type MaritalStatusQueryInput = z.infer<typeof maritalStatusQuerySchema>;
