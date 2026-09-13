import { z } from 'zod';

export const createReligionSchema = z.object({
  code: z.string().optional(),
  arabicName: z.string().min(1, 'Arabic name is required'),
  englishName: z.string().optional(),
});

export const updateReligionSchema = createReligionSchema.partial().extend({
  isActive: z.boolean().optional(),
});

export const religionQuerySchema = z.object({
  page: z.string().optional().transform((val) => (val ? parseInt(val, 10) : 1)),
  limit: z.string().optional().transform((val) => (val ? parseInt(val, 10) : 50)),
  search: z.string().optional(),
  isActive: z
    .string()
    .optional()
    .transform((val) => (val === undefined ? undefined : val === 'true')),
});

export type CreateReligionInput = z.infer<typeof createReligionSchema>;
export type UpdateReligionInput = z.infer<typeof updateReligionSchema>;
export type ReligionQueryInput = z.infer<typeof religionQuerySchema>;
