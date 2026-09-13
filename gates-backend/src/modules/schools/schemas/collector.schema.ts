import { z } from 'zod';

export const createCollectorSchema = z.object({
  serial: z.string().optional().nullable(),
  arabicName: z.string().min(1, 'Arabic name is required'),
  englishName: z.string().optional().nullable(),
});

export const updateCollectorSchema = createCollectorSchema.partial();

export const collectorQuerySchema = z.object({
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().max(1000).optional(),
  search: z.string().optional(),
  isActive: z.coerce.boolean().optional(),
});
