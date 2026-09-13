import { z } from 'zod';

export const createContractorSchema = z.object({
  serial: z.string().optional(),
  arabicName: z.string().min(1, 'Arabic name is required'),
  englishName: z.string().optional(),
  taxNumber: z.string().optional().nullable(),
  phone: z.string().optional().nullable(),
  address: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
});

export const updateContractorSchema = createContractorSchema.partial();

export const contractorQuerySchema = z.object({
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().max(1000).optional(),
  search: z.string().optional(),
  isActive: z.coerce.boolean().optional(),
});

