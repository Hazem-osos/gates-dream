import { z } from 'zod';

export const createNationalitySchema = z.object({
  code: z.string().optional(),
  arabicName: z.string().min(1, 'Arabic name is required'),
  englishName: z.string().optional(),
});

export const updateNationalitySchema = createNationalitySchema.partial().extend({
  isActive: z.boolean().optional(),
});

export const nationalityQuerySchema = z.object({
  page: z.string().optional().transform((val) => (val ? parseInt(val, 10) : 1)),
  limit: z.string().optional().transform((val) => (val ? parseInt(val, 10) : 50)),
  search: z.string().optional(),
  isActive: z
    .string()
    .optional()
    .transform((val) => (val === undefined ? undefined : val === 'true')),
});

export type CreateNationalityInput = z.infer<typeof createNationalitySchema>;
export type UpdateNationalityInput = z.infer<typeof updateNationalitySchema>;
export type NationalityQueryInput = z.infer<typeof nationalityQuerySchema>;
