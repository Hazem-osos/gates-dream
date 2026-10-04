import { z } from 'zod';

export const createLocationSchema = z.object({
  warehouseId: z.string().uuid('اختر المخزن'),
  code: z.string().optional(),
  arabicName: z.string().min(1, 'اسم الموقع بالعربية مطلوب'),
  englishName: z.string().optional(),
});

export const updateLocationSchema = createLocationSchema.partial();

export const locationQuerySchema = z.object({
  page: z.string().optional().transform((val) => (val ? parseInt(val, 10) : 1)),
  limit: z.string().optional().transform((val) => (val ? parseInt(val, 10) : 50)),
  search: z.string().optional(),
  warehouseId: z.string().uuid().optional(),
});

export type CreateLocationInput = z.infer<typeof createLocationSchema>;
export type UpdateLocationInput = z.infer<typeof updateLocationSchema>;
export type LocationQueryInput = z.infer<typeof locationQuerySchema>;
