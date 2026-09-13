import { z } from 'zod';

export const createDistributorSchema = z.object({
  serial: z.string().optional(),
  arabicName: z.string().min(1, 'Arabic name is required'),
  englishName: z.string().optional(),
  nationality: z.string().optional(),
  barcode: z.string().optional(),
  phone1: z.string().optional(),
  phone2: z.string().optional(),
  mobile: z.string().optional(),
  fax: z.string().optional(),
  email: z.string().email().optional().or(z.literal('')),
  website: z.string().url().optional().or(z.literal('')),
  country: z.string().optional(),
  city: z.string().optional(),
  area: z.string().optional(),
  street: z.string().optional(),
  postalCode: z.string().optional(),
  poBox: z.string().optional(),
});

export const updateDistributorSchema = createDistributorSchema.partial();

export type CreateDistributorInput = z.infer<typeof createDistributorSchema>;
export type UpdateDistributorInput = z.infer<typeof updateDistributorSchema>;

